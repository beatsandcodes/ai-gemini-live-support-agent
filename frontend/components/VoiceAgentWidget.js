import React, { useState, useRef, useCallback, useEffect } from 'react';
import ChatWindow from './ChatWindow';

// ─── Constants ─────────────────────────────────────────────────────────────────
const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8080/ws';
const AUDIO_SAMPLE_RATE = 16000;
const AUDIO_CHUNK_SIZE = 4096;
const PLAYBACK_SAMPLE_RATE = 24000;

/**
 * VoiceAgentWidget — Main voice interaction component.
 * Handles WebSocket connection, microphone capture, audio playback,
 * and orchestrates the full voice conversation flow.
 */
export default function VoiceAgentWidget() {
    // ── State ──
    const [status, setStatus] = useState('disconnected'); // disconnected | connecting | connected | listening | processing | speaking | error
    const [isSessionActive, setIsSessionActive] = useState(false);
    const [isListening, setIsListening] = useState(false);
    const [messages, setMessages] = useState([]);
    const [isTyping, setIsTyping] = useState(false);
    const [textInput, setTextInput] = useState('');
    const [volume, setVolume] = useState(0);
    const [error, setError] = useState(null);

    // ── Refs ──
    const wsRef = useRef(null);
    const audioContextRef = useRef(null);
    const playbackContextRef = useRef(null);
    const streamRef = useRef(null);
    const processorRef = useRef(null);
    const sourceRef = useRef(null);
    const analyserRef = useRef(null);
    const animFrameRef = useRef(null);
    const audioQueueRef = useRef([]);
    const isPlayingRef = useRef(false);
    const currentResponseRef = useRef('');
    const stopMicrophoneRef = useRef(null);

    // ── Cleanup on unmount ──
    useEffect(() => {
        return () => {
            disconnectAll();
        };
    }, []);

    // ── Volume Analyzer ──
    const startVolumeAnalyzer = useCallback((stream) => {
        try {
            const ctx = audioContextRef.current;
            if (!ctx) return;

            const analyser = ctx.createAnalyser();
            analyser.fftSize = 256;
            analyserRef.current = analyser;

            const source = ctx.createMediaStreamSource(stream);
            source.connect(analyser);

            const dataArray = new Uint8Array(analyser.frequencyBinCount);

            const updateVolume = () => {
                if (!analyserRef.current) return;
                analyserRef.current.getByteFrequencyData(dataArray);
                const avg = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
                setVolume(avg / 255);
                animFrameRef.current = requestAnimationFrame(updateVolume);
            };

            updateVolume();
        } catch (e) {
            console.warn('Volume analyzer error:', e);
        }
    }, []);

    const stopVolumeAnalyzer = useCallback(() => {
        if (animFrameRef.current) {
            cancelAnimationFrame(animFrameRef.current);
            animFrameRef.current = null;
        }
        analyserRef.current = null;
        setVolume(0);
    }, []);

    // ──────────────────────────────────────────────────────────────────────────────
    // WebSocket Connection
    // ──────────────────────────────────────────────────────────────────────────────
    const connectWebSocket = useCallback(() => {
        return new Promise((resolve, reject) => {
            try {
                setStatus('connecting');
                setError(null);

                const ws = new WebSocket(WS_URL);
                wsRef.current = ws;

                ws.onopen = () => {
                    console.log('[WS] Connected');
                    setStatus('connected');
                    addMessage('system', 'Connected to support server');
                    resolve(ws);
                };

                ws.onmessage = (event) => {
                    handleServerMessage(JSON.parse(event.data));
                };

                ws.onerror = (err) => {
                    console.error('[WS] Error:', err);
                    setStatus('error');
                    setError('Connection error. Please check if the backend is running.');
                    reject(err);
                };

                ws.onclose = (event) => {
                    console.log('[WS] Closed:', event.code, event.reason);
                    setStatus('disconnected');
                    setIsSessionActive(false);
                    setIsListening(false);
                    if (event.code !== 1000) {
                        addMessage('system', 'Connection lost. Click "Talk to Support" to reconnect.');
                    }
                };
            } catch (err) {
                setStatus('error');
                setError(err.message);
                reject(err);
            }
        });
    }, []);

    // ──────────────────────────────────────────────────────────────────────────────
    // Server Message Handler
    // ──────────────────────────────────────────────────────────────────────────────
    const handleServerMessage = useCallback((message) => {
        switch (message.type) {
            case 'welcome':
                console.log('[Server]', message.data.message);
                break;

            case 'session_started':
                console.log('[Server] Session started');
                setIsSessionActive(true);
                setStatus('connected');
                addMessage('system', 'AI agent is ready. Start speaking or type your question.');
                break;

            case 'transcript':
                // Accumulate AI text response
                if (message.data && message.data !== '[TURN_COMPLETE]') {
                    currentResponseRef.current += message.data;
                }
                break;

            case 'audio':
                setStatus('speaking');
                setIsTyping(false);
                queueAudioPlayback(message.data, message.mimeType);
                break;

            case 'turn_complete':
                // The AI finished its response
                if (currentResponseRef.current.trim()) {
                    addMessage('assistant', currentResponseRef.current.trim());
                }
                currentResponseRef.current = '';
                setIsTyping(false);
                setStatus(isListeningRef.current ? 'listening' : 'connected');
                break;

            case 'tool_call':
                setIsTyping(true);
                const toolData = message.data;
                addMessage('tool', toolData.result?.message || `Executed: ${toolData.name}`, {
                    name: toolData.name,
                    args: toolData.args,
                });
                break;

            case 'interrupted':
                // Clear audio queue when user interrupts
                audioQueueRef.current = [];
                isPlayingRef.current = false;
                currentResponseRef.current = '';
                break;

            case 'session_ended':
                setIsSessionActive(false);
                setIsListening(false);
                setStatus('disconnected');
                addMessage('system', 'Session ended.');
                break;

            case 'rate_limited':
                console.warn('[Rate Limited]', message.data, message.code);
                setIsTyping(false);
                addMessage('system', `⚠️ ${message.data}`);
                // If session timed out, clean up the frontend session state
                if (message.code === 'SESSION_TIMEOUT') {
                    stopMicrophoneRef.current?.();
                    setIsSessionActive(false);
                    setIsListening(false);
                    setStatus('disconnected');
                    addMessage('system', 'Session timed out. Click "Talk to Support" to start a new session.');
                }
                break;

            case 'error':
                console.error('[Server Error]', message.data);
                setError(message.data);
                setIsTyping(false);
                addMessage('system', `Error: ${message.data}`);
                break;

            default:
                console.log('[Server] Unknown message:', message);
        }
    }, []);

    // Track isListening in a ref for use in callbacks
    const isListeningRef = useRef(false);
    useEffect(() => {
        isListeningRef.current = isListening;
    }, [isListening]);

    // ──────────────────────────────────────────────────────────────────────────────
    // Audio Capture (Microphone → PCM → WebSocket)
    // ──────────────────────────────────────────────────────────────────────────────
    const startMicrophone = useCallback(async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    sampleRate: AUDIO_SAMPLE_RATE,
                    channelCount: 1,
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true,
                },
            });

            streamRef.current = stream;

            // Create AudioContext for PCM capture
            audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)({
                sampleRate: AUDIO_SAMPLE_RATE,
            });

            const source = audioContextRef.current.createMediaStreamSource(stream);
            sourceRef.current = source;

            // Load the modern AudioWorklet processor (from public/pcm-processor.js)
            await audioContextRef.current.audioWorklet.addModule('/pcm-processor.js');

            // Use AudioWorklet to capture raw PCM data in a background thread
            const processor = new AudioWorkletNode(audioContextRef.current, 'pcm-processor');
            processorRef.current = processor;

            processor.port.onmessage = (e) => {
                if (!isListeningRef.current || !wsRef.current) return;

                const inputData = e.data; // Float32Array from worklet

                // Convert Float32 to Int16 PCM
                const pcm16 = new Int16Array(inputData.length);
                for (let i = 0; i < inputData.length; i++) {
                    const s = Math.max(-1, Math.min(1, inputData[i]));
                    pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
                }

                // Convert to base64
                const base64 = arrayBufferToBase64(pcm16.buffer);

                // Send audio data to backend
                if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
                    wsRef.current.send(JSON.stringify({ type: 'audio', data: base64 }));
                }
            };

            source.connect(processor);
            processor.connect(audioContextRef.current.destination);

            // Start volume analyzer
            startVolumeAnalyzer(stream);

            setIsListening(true);
            setStatus('listening');

            console.log('[Audio] Microphone started');
        } catch (err) {
            console.error('[Audio] Microphone error:', err);
            setError('Microphone access denied. Please allow microphone permissions.');
            throw err;
        }
    }, [startVolumeAnalyzer]);

    const stopMicrophone = useCallback(() => {
        if (processorRef.current) {
            processorRef.current.disconnect();
            processorRef.current = null;
        }
        if (sourceRef.current) {
            sourceRef.current.disconnect();
            sourceRef.current = null;
        }
        if (streamRef.current) {
            streamRef.current.getTracks().forEach((track) => track.stop());
            streamRef.current = null;
        }
        if (audioContextRef.current) {
            audioContextRef.current.close().catch(() => { });
            audioContextRef.current = null;
        }

        stopVolumeAnalyzer();
        setIsListening(false);
        console.log('[Audio] Microphone stopped');
    }, [stopVolumeAnalyzer]);

    // Keep ref in sync so handleServerMessage can call stopMicrophone
    useEffect(() => {
        stopMicrophoneRef.current = stopMicrophone;
    }, [stopMicrophone]);

    // ──────────────────────────────────────────────────────────────────────────────
    // Audio Playback (Server Audio → Speaker)
    // ──────────────────────────────────────────────────────────────────────────────
    const queueAudioPlayback = useCallback((base64Data, mimeType) => {
        audioQueueRef.current.push({ data: base64Data, mimeType });
        if (!isPlayingRef.current) {
            processAudioQueue();
        }
    }, []);

    const processAudioQueue = useCallback(async () => {
        isPlayingRef.current = true;

        while (audioQueueRef.current.length > 0) {
            const chunk = audioQueueRef.current.shift();
            try {
                await playAudioChunk(chunk.data);
            } catch (err) {
                console.warn('[Audio] Playback error:', err);
            }
        }

        isPlayingRef.current = false;
    }, []);

    const playAudioChunk = useCallback((base64Data) => {
        return new Promise((resolve, reject) => {
            try {
                if (!playbackContextRef.current || playbackContextRef.current.state === 'closed') {
                    playbackContextRef.current = new (window.AudioContext || window.webkitAudioContext)({
                        sampleRate: PLAYBACK_SAMPLE_RATE,
                    });
                }

                const ctx = playbackContextRef.current;

                // Decode base64 to binary
                const binaryString = atob(base64Data);
                const bytes = new Uint8Array(binaryString.length);
                for (let i = 0; i < binaryString.length; i++) {
                    bytes[i] = binaryString.charCodeAt(i);
                }

                // Convert Int16 PCM to Float32
                const int16 = new Int16Array(bytes.buffer);
                const float32 = new Float32Array(int16.length);
                for (let i = 0; i < int16.length; i++) {
                    float32[i] = int16[i] / 32768.0;
                }

                // Create audio buffer and play
                const audioBuffer = ctx.createBuffer(1, float32.length, PLAYBACK_SAMPLE_RATE);
                audioBuffer.getChannelData(0).set(float32);

                const source = ctx.createBufferSource();
                source.buffer = audioBuffer;
                source.connect(ctx.destination);
                source.onended = resolve;
                source.start();
            } catch (err) {
                reject(err);
            }
        });
    }, []);

    // ──────────────────────────────────────────────────────────────────────────────
    // Session Management
    // ──────────────────────────────────────────────────────────────────────────────
    const startSession = useCallback(async () => {
        try {
            setError(null);
            setMessages([]);
            currentResponseRef.current = '';

            // Connect WebSocket if not connected
            if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
                await connectWebSocket();
            }

            // Start agent session
            wsRef.current.send(JSON.stringify({ type: 'start_session' }));

            // Wait briefly for session confirmation, then start mic
            await new Promise((r) => setTimeout(r, 500));

            // Start microphone
            await startMicrophone();

            // Initialize playback context
            if (!playbackContextRef.current || playbackContextRef.current.state === 'closed') {
                playbackContextRef.current = new (window.AudioContext || window.webkitAudioContext)({
                    sampleRate: PLAYBACK_SAMPLE_RATE,
                });
            }
        } catch (err) {
            console.error('[Session] Failed to start:', err);
            setError(`Failed to start session: ${err.message}`);
            setStatus('error');
        }
    }, [connectWebSocket, startMicrophone]);

    const endSession = useCallback(() => {
        stopMicrophone();
        audioQueueRef.current = [];
        isPlayingRef.current = false;
        currentResponseRef.current = '';

        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({ type: 'end_session' }));
        }

        setIsSessionActive(false);
        setStatus('disconnected');
        addMessage('system', 'Session ended. Thank you for contacting support!');
    }, [stopMicrophone]);

    const toggleSession = useCallback(() => {
        if (isSessionActive) {
            endSession();
        } else {
            startSession();
        }
    }, [isSessionActive, startSession, endSession]);

    const disconnectAll = useCallback(() => {
        stopMicrophone();
        stopVolumeAnalyzer();

        if (playbackContextRef.current) {
            playbackContextRef.current.close().catch(() => { });
            playbackContextRef.current = null;
        }

        if (wsRef.current) {
            wsRef.current.close(1000);
            wsRef.current = null;
        }
    }, [stopMicrophone, stopVolumeAnalyzer]);

    // ──────────────────────────────────────────────────────────────────────────────
    // Text Message Sending
    // ──────────────────────────────────────────────────────────────────────────────
    const sendTextMessage = useCallback(() => {
        if (!textInput.trim() || !wsRef.current || !isSessionActive) return;

        const text = textInput.trim();
        addMessage('user', text);
        setTextInput('');
        setIsTyping(true);

        wsRef.current.send(JSON.stringify({ type: 'text', data: text }));
    }, [textInput, isSessionActive]);

    const handleKeyPress = useCallback(
        (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendTextMessage();
            }
        },
        [sendTextMessage]
    );

    // ──────────────────────────────────────────────────────────────────────────────
    // Message Management
    // ──────────────────────────────────────────────────────────────────────────────
    const addMessage = useCallback((role, content, toolInfo = null) => {
        setMessages((prev) => [
            ...prev,
            {
                role,
                content,
                timestamp: Date.now(),
                toolInfo,
            },
        ]);
    }, []);

    // ──────────────────────────────────────────────────────────────────────────────
    // Render
    // ──────────────────────────────────────────────────────────────────────────────
    return (
        <div className="flex flex-col lg:flex-row gap-6 w-full max-w-6xl mx-auto h-[calc(100vh-200px)] min-h-[520px]">
            {/* ── Left Panel: Voice Control ── */}
            <div className="glass-card flex flex-col items-center justify-center p-8 lg:w-[400px] flex-shrink-0">
                {/* Voice Visualization */}
                <div className="relative mb-8">
                    {/* Ambient glow behind button */}
                    {isSessionActive && (
                        <>
                            <div
                                className="absolute inset-0 rounded-full blur-2xl transition-opacity duration-700"
                                style={{
                                    background: isListening
                                        ? `radial-gradient(circle, rgba(239,68,68,${0.2 + volume * 0.3}) 0%, transparent 70%)`
                                        : 'radial-gradient(circle, rgba(124,58,237,0.15) 0%, transparent 70%)',
                                    transform: `scale(${2.5 + volume * 1.5})`,
                                }}
                            />
                            {/* Pulse rings */}
                            <div className={`pulse-ring ${isListening ? 'active' : ''}`} />
                            <div
                                className={`pulse-ring ${isListening ? 'active' : ''}`}
                                style={{ animationDelay: '0.5s' }}
                            />
                        </>
                    )}

                    {/* Main Voice Button */}
                    <button
                        id="voice-toggle-btn"
                        onClick={toggleSession}
                        className={`voice-btn relative z-10 ${isSessionActive ? 'active' : ''}`}
                        aria-label={isSessionActive ? 'End conversation' : 'Start conversation'}
                    >
                        {isSessionActive ? (
                            // Stop icon
                            <svg width="28" height="28" viewBox="0 0 24 24" fill="white">
                                <rect x="6" y="6" width="12" height="12" rx="2" />
                            </svg>
                        ) : (
                            // Microphone icon
                            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                                <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                                <line x1="12" y1="19" x2="12" y2="23" />
                                <line x1="8" y1="23" x2="16" y2="23" />
                            </svg>
                        )}
                    </button>
                </div>

                {/* Status Label */}
                <div className="text-center mb-6">
                    <p className="text-lg font-semibold text-white mb-1">
                        {isSessionActive
                            ? status === 'listening'
                                ? 'Listening...'
                                : status === 'speaking'
                                    ? 'Agent Speaking...'
                                    : status === 'processing'
                                        ? 'Processing...'
                                        : 'Connected'
                            : 'Talk to Support'}
                    </p>
                    <p className="text-sm text-white/40">
                        {isSessionActive
                            ? 'Speak naturally or type below'
                            : 'Click the button to start a voice conversation'}
                    </p>
                </div>

                {/* Voice Waveform Visualization */}
                {isSessionActive && isListening && (
                    <div className="voice-wave-container mb-6">
                        {[...Array(7)].map((_, i) => (
                            <div
                                key={i}
                                className="voice-wave-bar"
                                style={{
                                    height: `${Math.max(15, volume * 100 * (0.5 + Math.random() * 0.5))}%`,
                                    animationDelay: `${i * 0.1}s`,
                                }}
                            />
                        ))}
                    </div>
                )}

                {/* Text Input (Alternative to voice) */}
                {isSessionActive && (
                    <div className="w-full mt-auto">
                        <div className="flex gap-2">
                            <input
                                id="text-input"
                                type="text"
                                value={textInput}
                                onChange={(e) => setTextInput(e.target.value)}
                                onKeyDown={handleKeyPress}
                                placeholder="Or type your message..."
                                className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-white/30 focus:outline-none focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/20 transition-all"
                            />
                            <button
                                id="send-text-btn"
                                onClick={sendTextMessage}
                                disabled={!textInput.trim()}
                                className="px-4 py-3 rounded-xl bg-gradient-to-r from-purple-600 to-blue-600 text-white text-sm font-medium disabled:opacity-30 hover:opacity-90 transition-all"
                            >
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <line x1="22" y1="2" x2="11" y2="13" />
                                    <polygon points="22 2 15 22 11 13 2 9 22 2" />
                                </svg>
                            </button>
                        </div>
                    </div>
                )}

                {/* Error Display */}
                {error && (
                    <div className="w-full mt-4 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-xs animate-fade-in">
                        <div className="flex items-start gap-2">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="flex-shrink-0 mt-0.5">
                                <circle cx="12" cy="12" r="10" />
                                <line x1="12" y1="8" x2="12" y2="12" />
                                <line x1="12" y1="16" x2="12.01" y2="16" />
                            </svg>
                            <span>{error}</span>
                        </div>
                    </div>
                )}
            </div>

            {/* ── Right Panel: Chat Window ── */}
            <div className="glass-card flex-1 min-h-0 overflow-hidden">
                <ChatWindow messages={messages} isTyping={isTyping} status={status} />
            </div>
        </div>
    );
}

// ─── Utility Functions ─────────────────────────────────────────────────────────

/**
 * Convert an ArrayBuffer to a base64 string
 */
function arrayBufferToBase64(buffer) {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    const chunkSize = 8192;
    for (let i = 0; i < bytes.length; i += chunkSize) {
        const chunk = bytes.subarray(i, i + chunkSize);
        binary += String.fromCharCode.apply(null, chunk);
    }
    return btoa(binary);
}
