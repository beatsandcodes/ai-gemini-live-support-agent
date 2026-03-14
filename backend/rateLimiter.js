/**
 * Rate Limiter for AI Usage
 *
 * Protects the Gemini Live API from abuse by enforcing limits on:
 *  - Concurrent sessions per IP
 *  - Session creation frequency per IP (sliding window)
 *  - Audio data throughput per session (bytes/second)
 *  - Text message frequency per session
 *  - Global concurrent session cap
 *
 * All limits are configurable via environment variables.
 */

// ─── Default Limits (overridable via env) ──────────────────────────────────────
const DEFAULTS = {
    // Per-IP limits
    MAX_CONCURRENT_SESSIONS_PER_IP: 2,     // max simultaneous sessions from one IP
    MAX_SESSIONS_PER_WINDOW: 10,           // max new sessions in the time window
    SESSION_WINDOW_MS: 15 * 60 * 1000,     // 15-minute sliding window

    // Per-session limits
    MAX_AUDIO_BYTES_PER_SECOND: 128_000,   // ~128 KB/s (16kHz 16-bit mono PCM ≈ 32 KB/s, generous headroom)
    MAX_TEXT_MESSAGES_PER_MINUTE: 20,       // text message rate cap
    MAX_SESSION_DURATION_MS: 30 * 60_000,  // 30-minute hard session timeout

    // Global limits
    MAX_GLOBAL_CONCURRENT_SESSIONS: 50,    // server-wide cap
};

function envInt(key, fallback) {
    const v = process.env[key];
    return v !== undefined ? parseInt(v, 10) : fallback;
}

// ─── RateLimiter Class ─────────────────────────────────────────────────────────
class RateLimiter {
    constructor() {
        // Load limits (env overrides defaults)
        this.limits = {
            maxConcurrentPerIp: envInt('RL_MAX_CONCURRENT_PER_IP', DEFAULTS.MAX_CONCURRENT_SESSIONS_PER_IP),
            maxSessionsPerWindow: envInt('RL_MAX_SESSIONS_PER_WINDOW', DEFAULTS.MAX_SESSIONS_PER_WINDOW),
            sessionWindowMs: envInt('RL_SESSION_WINDOW_MS', DEFAULTS.SESSION_WINDOW_MS),
            maxAudioBytesPerSec: envInt('RL_MAX_AUDIO_BYTES_PER_SEC', DEFAULTS.MAX_AUDIO_BYTES_PER_SECOND),
            maxTextPerMinute: envInt('RL_MAX_TEXT_PER_MINUTE', DEFAULTS.MAX_TEXT_MESSAGES_PER_MINUTE),
            maxSessionDurationMs: envInt('RL_MAX_SESSION_DURATION_MS', DEFAULTS.MAX_SESSION_DURATION_MS),
            maxGlobalSessions: envInt('RL_MAX_GLOBAL_SESSIONS', DEFAULTS.MAX_GLOBAL_CONCURRENT_SESSIONS),
        };

        // IP → Set<clientId>  (active sessions per IP)
        this.activeSessions = new Map();

        // IP → [timestamp, timestamp, ...]  (session creation times)
        this.sessionHistory = new Map();

        // clientId → { audioBytes, audioWindowStart, textCount, textWindowStart, sessionStart }
        this.sessionMetrics = new Map();

        // Global session count
        this.globalSessionCount = 0;

        // Periodic cleanup every 5 minutes
        this._cleanupInterval = setInterval(() => this._cleanup(), 5 * 60_000);
    }

    // ── Resolve client IP (supports proxies) ──────────────────────────────────
    resolveIp(req) {
        return (
            req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
            req.headers['x-real-ip'] ||
            req.socket?.remoteAddress ||
            'unknown'
        );
    }

    // ────────────────────────────────────────────────────────────────────────────
    // Connection-level check (called when a WebSocket connects)
    // ────────────────────────────────────────────────────────────────────────────
    checkConnection(ip) {
        const active = this.activeSessions.get(ip);
        const activeCount = active ? active.size : 0;

        if (activeCount >= this.limits.maxConcurrentPerIp) {
            return {
                allowed: false,
                reason: `Too many concurrent connections from your IP (max ${this.limits.maxConcurrentPerIp}). Please close an existing session first.`,
                code: 'MAX_CONCURRENT_IP',
            };
        }

        return { allowed: true };
    }

    // ────────────────────────────────────────────────────────────────────────────
    // Session-start check (called when start_session message is received)
    // ────────────────────────────────────────────────────────────────────────────
    checkSessionStart(ip, clientId) {
        // Global cap
        if (this.globalSessionCount >= this.limits.maxGlobalSessions) {
            return {
                allowed: false,
                reason: `Server is at capacity (${this.limits.maxGlobalSessions} active sessions). Please try again later.`,
                code: 'MAX_GLOBAL_SESSIONS',
            };
        }

        // Per-IP concurrent
        const active = this.activeSessions.get(ip);
        const activeCount = active ? active.size : 0;
        if (activeCount >= this.limits.maxConcurrentPerIp) {
            return {
                allowed: false,
                reason: `You already have ${activeCount} active session(s). Maximum is ${this.limits.maxConcurrentPerIp}.`,
                code: 'MAX_CONCURRENT_IP',
            };
        }

        // Sliding window — session creation frequency
        const now = Date.now();
        const history = this.sessionHistory.get(ip) || [];
        const windowStart = now - this.limits.sessionWindowMs;
        const recentSessions = history.filter((t) => t > windowStart);

        if (recentSessions.length >= this.limits.maxSessionsPerWindow) {
            const windowMinutes = Math.round(this.limits.sessionWindowMs / 60_000);
            return {
                allowed: false,
                reason: `Too many sessions created (${this.limits.maxSessionsPerWindow} in ${windowMinutes} min). Please wait before starting a new session.`,
                code: 'MAX_SESSION_FREQUENCY',
            };
        }

        return { allowed: true };
    }

    // ────────────────────────────────────────────────────────────────────────────
    // Register a new session (call after a successful session start)
    // ────────────────────────────────────────────────────────────────────────────
    registerSession(ip, clientId) {
        // Track active sessions for this IP
        if (!this.activeSessions.has(ip)) {
            this.activeSessions.set(ip, new Set());
        }
        this.activeSessions.get(ip).add(clientId);

        // Record creation timestamp
        if (!this.sessionHistory.has(ip)) {
            this.sessionHistory.set(ip, []);
        }
        this.sessionHistory.get(ip).push(Date.now());

        // Initialise per-session metrics
        const now = Date.now();
        this.sessionMetrics.set(clientId, {
            audioBytes: 0,
            audioWindowStart: now,
            textCount: 0,
            textWindowStart: now,
            sessionStart: now,
        });

        this.globalSessionCount++;

        console.log(
            `[RateLimiter] Session registered: ${clientId} | IP: ${ip} | ` +
            `IP-active: ${this.activeSessions.get(ip).size} | Global: ${this.globalSessionCount}`
        );
    }

    // ────────────────────────────────────────────────────────────────────────────
    // Unregister a session (call on disconnect or session end)
    // ────────────────────────────────────────────────────────────────────────────
    unregisterSession(ip, clientId) {
        const active = this.activeSessions.get(ip);
        if (active) {
            active.delete(clientId);
            if (active.size === 0) this.activeSessions.delete(ip);
        }

        this.sessionMetrics.delete(clientId);
        this.globalSessionCount = Math.max(0, this.globalSessionCount - 1);

        console.log(
            `[RateLimiter] Session unregistered: ${clientId} | Global: ${this.globalSessionCount}`
        );
    }

    // ────────────────────────────────────────────────────────────────────────────
    // Check audio throughput (called on every audio message)
    // ────────────────────────────────────────────────────────────────────────────
    checkAudio(clientId, base64Length) {
        const metrics = this.sessionMetrics.get(clientId);
        if (!metrics) return { allowed: true };

        const now = Date.now();
        const elapsed = (now - metrics.audioWindowStart) / 1000; // seconds

        // Reset the window every second
        if (elapsed >= 1) {
            metrics.audioBytes = 0;
            metrics.audioWindowStart = now;
        }

        // base64 inflates size by ~33%, estimate raw bytes
        const rawBytes = Math.ceil(base64Length * 0.75);
        metrics.audioBytes += rawBytes;

        if (metrics.audioBytes > this.limits.maxAudioBytesPerSec) {
            return {
                allowed: false,
                reason: 'Audio data rate exceeded. Please speak normally.',
                code: 'AUDIO_RATE_EXCEEDED',
            };
        }

        // Session duration check
        if (now - metrics.sessionStart > this.limits.maxSessionDurationMs) {
            const maxMinutes = Math.round(this.limits.maxSessionDurationMs / 60_000);
            return {
                allowed: false,
                reason: `Session exceeded maximum duration of ${maxMinutes} minutes. Please start a new session.`,
                code: 'SESSION_TIMEOUT',
            };
        }

        return { allowed: true };
    }

    // ────────────────────────────────────────────────────────────────────────────
    // Check text message rate (called on every text message)
    // ────────────────────────────────────────────────────────────────────────────
    checkText(clientId) {
        const metrics = this.sessionMetrics.get(clientId);
        if (!metrics) return { allowed: true };

        const now = Date.now();
        const elapsed = (now - metrics.textWindowStart) / 1000; // seconds

        // Reset window every 60s
        if (elapsed >= 60) {
            metrics.textCount = 0;
            metrics.textWindowStart = now;
        }

        metrics.textCount++;

        if (metrics.textCount > this.limits.maxTextPerMinute) {
            return {
                allowed: false,
                reason: `Too many messages (max ${this.limits.maxTextPerMinute}/min). Please slow down.`,
                code: 'TEXT_RATE_EXCEEDED',
            };
        }

        // Session duration check
        if (now - metrics.sessionStart > this.limits.maxSessionDurationMs) {
            const maxMinutes = Math.round(this.limits.maxSessionDurationMs / 60_000);
            return {
                allowed: false,
                reason: `Session exceeded maximum duration of ${maxMinutes} minutes. Please start a new session.`,
                code: 'SESSION_TIMEOUT',
            };
        }

        return { allowed: true };
    }

    // ────────────────────────────────────────────────────────────────────────────
    // Get current usage stats (for the /health or admin endpoints)
    // ────────────────────────────────────────────────────────────────────────────
    getStats() {
        return {
            globalActiveSessions: this.globalSessionCount,
            maxGlobalSessions: this.limits.maxGlobalSessions,
            uniqueIPs: this.activeSessions.size,
            limits: { ...this.limits },
        };
    }

    // ── Cleanup stale session history entries ─────────────────────────────────
    _cleanup() {
        const cutoff = Date.now() - this.limits.sessionWindowMs;
        for (const [ip, timestamps] of this.sessionHistory.entries()) {
            const filtered = timestamps.filter((t) => t > cutoff);
            if (filtered.length === 0) {
                this.sessionHistory.delete(ip);
            } else {
                this.sessionHistory.set(ip, filtered);
            }
        }
    }

    // ── Destroy (for graceful shutdown) ───────────────────────────────────────
    destroy() {
        if (this._cleanupInterval) {
            clearInterval(this._cleanupInterval);
            this._cleanupInterval = null;
        }
    }
}

module.exports = { RateLimiter };
