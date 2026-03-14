require('dotenv').config();

const express = require('express');
const http = require('http');
const { WebSocketServer } = require('ws');
const cors = require('cors');
const path = require('path');
const { SupportAgent } = require('./agent');
const { RateLimiter } = require('./rateLimiter');

// ─── Configuration ─────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 8080;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

if (!GEMINI_API_KEY) {
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.error('  ERROR: GEMINI_API_KEY environment variable is required');
    console.error('  Set it with: export GEMINI_API_KEY=your_api_key_here');
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    process.exit(1);
}

// ─── Express App ───────────────────────────────────────────────────────────────
const app = express();

app.use(cors({
    origin: process.env.FRONTEND_URL || '*',
    methods: ['GET', 'POST'],
    credentials: true,
}));

app.use(express.json());

// ─── Rate Limiter ──────────────────────────────────────────────────────────────
const rateLimiter = new RateLimiter();
console.log('[Server] Rate limiter initialised:', JSON.stringify(rateLimiter.limits, null, 2));

// ─── Health Check Endpoint ─────────────────────────────────────────────────────
app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        service: 'ai-gemini-live-support-agent',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        rateLimits: rateLimiter.getStats(),
    });
});

// ─── API Info Endpoint ─────────────────────────────────────────────────────────
app.get('/api/info', (req, res) => {
    res.json({
        service: 'Voice AI Customer Support Agent',
        version: '1.0.0',
        model: 'gemini-2.5-flash-native-audio-latest',
        capabilities: ['voice-input', 'voice-output', 'tool-calling', 'real-time-streaming'],
        tools: ['check_order', 'process_refund', 'faq'],
    });
});

// ─── Rate Limit Stats Endpoint ─────────────────────────────────────────────────
app.get('/api/rate-limits', (req, res) => {
    res.json(rateLimiter.getStats());
});

// ─── HTTP Server ───────────────────────────────────────────────────────────────
const server = http.createServer(app);

// ─── WebSocket Server ──────────────────────────────────────────────────────────
const wss = new WebSocketServer({
    server,
    path: '/ws',
    maxPayload: 1024 * 1024, // 1MB max payload
});

// Track active connections
let activeConnections = 0;

wss.on('connection', (ws, req) => {
    activeConnections++;
    const clientId = `client-${Date.now().toString(36)}`;
    const clientIp = rateLimiter.resolveIp(req);
    console.log(`[Server] Client connected: ${clientId} | IP: ${clientIp} (active: ${activeConnections})`);

    // ── Rate Limit: Connection-level check (DISABLED FOR NOW) ──
    const connCheck = { allowed: true }; // rateLimiter.checkConnection(clientIp);
    if (!connCheck.allowed) {
        console.warn(`[RateLimiter] Connection rejected for ${clientIp}: ${connCheck.code}`);
        ws.send(JSON.stringify({ type: 'error', data: connCheck.reason }));
        ws.close(4029, connCheck.reason);
        activeConnections--;
        return;
    }

    let agent = null;
    let sessionActive = false;

    // ── Send Welcome Message ──
    ws.send(JSON.stringify({
        type: 'welcome',
        data: {
            clientId,
            message: 'Connected to Voice AI Support Agent',
            rateLimits: {
                maxSessionDurationMin: Math.round(rateLimiter.limits.maxSessionDurationMs / 60_000),
                maxTextPerMinute: rateLimiter.limits.maxTextPerMinute,
            },
        },
    }));

    // ── Handle Incoming Messages ──
    ws.on('message', async (rawData) => {
        let message;
        try {
            message = JSON.parse(rawData.toString());
        } catch (err) {
            ws.send(JSON.stringify({ type: 'error', data: 'Invalid message format' }));
            return;
        }

        switch (message.type) {
            // ── Start a New Agent Session ──
            case 'start_session': {
                if (sessionActive) {
                    ws.send(JSON.stringify({ type: 'error', data: 'Session already active' }));
                    return;
                }

                // ── Rate Limit: Session-start check (DISABLED FOR NOW) ──
                const sessionCheck = { allowed: true }; // rateLimiter.checkSessionStart(clientIp, clientId);
                if (!sessionCheck.allowed) {
                    console.warn(`[RateLimiter] Session rejected for ${clientId}: ${sessionCheck.code}`);
                    ws.send(JSON.stringify({ type: 'rate_limited', data: sessionCheck.reason, code: sessionCheck.code }));
                    return;
                }

                console.log(`[Server] Starting agent session for ${clientId}`);
                agent = new SupportAgent(GEMINI_API_KEY);

                const connected = await agent.connect({
                    onText: (text) => {
                        if (ws.readyState === ws.OPEN) {
                            ws.send(JSON.stringify({ type: 'transcript', data: text }));
                        }
                    },
                    onAudio: (audioData, mimeType) => {
                        if (ws.readyState === ws.OPEN) {
                            ws.send(JSON.stringify({
                                type: 'audio',
                                data: audioData,
                                mimeType: mimeType || 'audio/pcm;rate=24000',
                            }));
                        }
                    },
                    onTurnComplete: () => {
                        if (ws.readyState === ws.OPEN) {
                            ws.send(JSON.stringify({ type: 'turn_complete' }));
                        }
                    },
                    onInterrupted: () => {
                        if (ws.readyState === ws.OPEN) {
                            ws.send(JSON.stringify({ type: 'interrupted' }));
                        }
                    },
                    onToolCall: (toolInfo) => {
                        if (ws.readyState === ws.OPEN) {
                            ws.send(JSON.stringify({
                                type: 'tool_call',
                                data: {
                                    name: toolInfo.name,
                                    args: toolInfo.args,
                                    result: toolInfo.result,
                                },
                            }));
                        }
                    },
                    onError: (error) => {
                        console.error(`[Server] Agent error for ${clientId}:`, error.message);
                        if (ws.readyState === ws.OPEN) {
                            ws.send(JSON.stringify({
                                type: 'error',
                                data: `Agent error: ${error.message}`,
                            }));
                        }
                    },
                    onClose: () => {
                        console.log(`[Server] Agent session closed for ${clientId}`);
                        sessionActive = false;
                        if (ws.readyState === ws.OPEN) {
                            ws.send(JSON.stringify({ type: 'session_ended' }));
                        }
                    },
                });

                if (connected) {
                    sessionActive = true;
                    rateLimiter.registerSession(clientIp, clientId);
                    ws.send(JSON.stringify({ type: 'session_started' }));
                    console.log(`[Server] Agent session started for ${clientId}`);
                } else {
                    ws.send(JSON.stringify({
                        type: 'error',
                        data: 'Failed to start agent session. Check API key and try again.',
                    }));
                }
                break;
            }

            // ── Send Audio Data to Agent ──
            case 'audio': {
                if (!sessionActive || !agent) {
                    return; // Silently ignore audio when no session
                }

                // ── Rate Limit: Audio throughput check (DISABLED FOR NOW) ──
                const audioCheck = { allowed: true }; // rateLimiter.checkAudio(clientId, message.data?.length || 0);
                if (!audioCheck.allowed) {
                    if (audioCheck.code === 'SESSION_TIMEOUT') {
                        ws.send(JSON.stringify({ type: 'rate_limited', data: audioCheck.reason, code: audioCheck.code }));
                        // Force end the session on timeout
                        agent.disconnect();
                        rateLimiter.unregisterSession(clientIp, clientId);
                        agent = null;
                        sessionActive = false;
                        return;
                    }
                    // For audio rate excess, silently drop the chunk (avoid spamming errors)
                    return;
                }

                agent.sendAudio(message.data);
                break;
            }

            // ── Send Text Message to Agent ──
            case 'text': {
                if (!sessionActive || !agent) {
                    ws.send(JSON.stringify({
                        type: 'error',
                        data: 'No active session. Please start a session first.',
                    }));
                    return;
                }

                // ── Rate Limit: Text message rate check (DISABLED FOR NOW) ──
                const textCheck = { allowed: true }; // rateLimiter.checkText(clientId);
                if (!textCheck.allowed) {
                    if (textCheck.code === 'SESSION_TIMEOUT') {
                        ws.send(JSON.stringify({ type: 'rate_limited', data: textCheck.reason, code: textCheck.code }));
                        agent.disconnect();
                        rateLimiter.unregisterSession(clientIp, clientId);
                        agent = null;
                        sessionActive = false;
                        return;
                    }
                    ws.send(JSON.stringify({ type: 'rate_limited', data: textCheck.reason, code: textCheck.code }));
                    return;
                }

                console.log(`[Server] Text from ${clientId}: ${message.data}`);
                agent.sendText(message.data);
                break;
            }

            // ── End Agent Session ──
            case 'end_session': {
                if (agent) {
                    console.log(`[Server] Ending session for ${clientId}`);
                    agent.disconnect();
                    rateLimiter.unregisterSession(clientIp, clientId);
                    agent = null;
                    sessionActive = false;
                }
                break;
            }

            default: {
                ws.send(JSON.stringify({
                    type: 'error',
                    data: `Unknown message type: ${message.type}`,
                }));
            }
        }
    });

    // ── Handle Client Disconnect ──
    ws.on('close', () => {
        activeConnections--;
        console.log(`[Server] Client disconnected: ${clientId} (active: ${activeConnections})`);
        if (agent) {
            agent.disconnect();
            agent = null;
        }
        if (sessionActive) {
            rateLimiter.unregisterSession(clientIp, clientId);
            sessionActive = false;
        }
    });

    // ── Handle WebSocket Errors ──
    ws.on('error', (error) => {
        console.error(`[Server] WebSocket error for ${clientId}:`, error.message);
    });
});

// ─── Start Server ──────────────────────────────────────────────────────────────
server.listen(PORT, () => {
    console.log('');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('  🤖 Voice AI Customer Support Agent');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`  HTTP Server:     http://localhost:${PORT}`);
    console.log(`  WebSocket:       ws://localhost:${PORT}/ws`);
    console.log(`  Health Check:    http://localhost:${PORT}/health`);
    console.log(`  Model:           gemini-2.5-flash-native-audio-latest`);
    console.log(`  Rate Limits:     http://localhost:${PORT}/api/rate-limits`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('');
});

// ─── Graceful Shutdown ─────────────────────────────────────────────────────────
process.on('SIGTERM', () => {
    console.log('[Server] SIGTERM received, shutting down gracefully...');
    rateLimiter.destroy();
    wss.clients.forEach((client) => {
        client.close(1001, 'Server shutting down');
    });
    server.close(() => {
        console.log('[Server] HTTP server closed');
        process.exit(0);
    });
});

process.on('SIGINT', () => {
    console.log('[Server] SIGINT received, shutting down...');
    rateLimiter.destroy();
    wss.clients.forEach((client) => {
        client.close(1001, 'Server shutting down');
    });
    server.close(() => {
        process.exit(0);
    });
});
