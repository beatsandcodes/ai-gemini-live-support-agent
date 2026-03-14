import React, { useRef, useEffect } from 'react';

/**
 * ChatWindow — Displays the conversation between user and AI agent.
 * 
 * Props:
 * @param {Array} messages - Array of message objects { role, content, timestamp, toolInfo }
 * @param {boolean} isTyping - Whether the AI is currently generating a response
 * @param {string} status - Current connection status
 */
export default function ChatWindow({ messages = [], isTyping = false, status = 'disconnected' }) {
    const messagesEndRef = useRef(null);
    const containerRef = useRef(null);

    // Auto-scroll to bottom when new messages arrive
    useEffect(() => {
        if (messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [messages, isTyping]);

    const formatTime = (timestamp) => {
        if (!timestamp) return '';
        const date = new Date(timestamp);
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    const getStatusConfig = () => {
        switch (status) {
            case 'connected':
                return { dotClass: 'connected', label: 'Connected', color: 'text-emerald-400' };
            case 'listening':
                return { dotClass: 'listening', label: 'Listening...', color: 'text-purple-400' };
            case 'processing':
                return { dotClass: 'connected', label: 'Processing...', color: 'text-blue-400' };
            case 'speaking':
                return { dotClass: 'connected', label: 'Speaking...', color: 'text-cyan-400' };
            case 'error':
                return { dotClass: 'error', label: 'Error', color: 'text-red-400' };
            default:
                return { dotClass: 'disconnected', label: 'Disconnected', color: 'text-gray-400' };
        }
    };

    const statusConfig = getStatusConfig();

    return (
        <div className="flex flex-col h-full">
            {/* ── Header ── */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                        </svg>
                    </div>
                    <div>
                        <h3 className="text-sm font-semibold text-white">Conversation</h3>
                        <div className={`flex items-center gap-1.5 text-xs ${statusConfig.color}`}>
                            <span className={`status-dot ${statusConfig.dotClass}`}></span>
                            {statusConfig.label}
                        </div>
                    </div>
                </div>
                <div className="text-xs text-white/30">
                    {messages.length > 0 ? `${messages.length} messages` : 'No messages yet'}
                </div>
            </div>

            {/* ── Messages Area ── */}
            <div
                ref={containerRef}
                className="flex-1 overflow-y-auto px-5 py-4 space-y-3"
                style={{ scrollBehavior: 'smooth' }}
            >
                {messages.length === 0 && !isTyping && (
                    <div className="flex flex-col items-center justify-center h-full text-center py-12 animate-fade-in">
                        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-500/20 to-blue-500/20 flex items-center justify-center mb-4 border border-white/5">
                            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="rgba(124,58,237,0.5)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                                <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                                <line x1="12" y1="19" x2="12" y2="23" />
                                <line x1="8" y1="23" x2="16" y2="23" />
                            </svg>
                        </div>
                        <p className="text-white/40 text-sm font-medium mb-1">No messages yet</p>
                        <p className="text-white/25 text-xs max-w-[200px]">
                            Click &quot;Talk to Support&quot; and start speaking to begin a conversation
                        </p>
                    </div>
                )}

                {messages.map((msg, index) => (
                    <MessageBubble key={index} message={msg} formatTime={formatTime} />
                ))}

                {/* ── Typing Indicator ── */}
                {isTyping && (
                    <div className="chat-message chat-message-ai px-4 py-3 max-w-[80%]">
                        <div className="flex items-center gap-2">
                            <div className="typing-indicator">
                                <div className="typing-dot"></div>
                                <div className="typing-dot"></div>
                                <div className="typing-dot"></div>
                            </div>
                            <span className="text-xs text-white/30">Agent is thinking...</span>
                        </div>
                    </div>
                )}

                <div ref={messagesEndRef} />
            </div>
        </div>
    );
}

/**
 * Individual message bubble component
 */
function MessageBubble({ message, formatTime }) {
    const { role, content, timestamp, toolInfo } = message;

    if (role === 'system') {
        return (
            <div className="flex justify-center">
                <div className="chat-message chat-message-system px-4 py-2 text-xs text-white/40 text-center max-w-[90%]">
                    {content}
                </div>
            </div>
        );
    }

    if (role === 'tool') {
        return (
            <div className="chat-message chat-message-tool px-4 py-3 max-w-[85%] ml-2">
                <div className="flex items-center gap-2 mb-1.5">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
                    </svg>
                    <span className="text-xs font-semibold text-emerald-400">
                        Tool: {toolInfo?.name || 'unknown'}
                    </span>
                </div>
                <p className="text-xs text-white/50 leading-relaxed whitespace-pre-wrap">{content}</p>
            </div>
        );
    }

    const isUser = role === 'user';

    return (
        <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
            <div
                className={`chat-message ${isUser ? 'chat-message-user' : 'chat-message-ai'
                    } px-4 py-3 max-w-[80%]`}
            >
                <div className="flex items-center gap-2 mb-1">
                    {!isUser && (
                        <div className="w-5 h-5 rounded-md bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center flex-shrink-0">
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="white" strokeWidth="0">
                                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
                            </svg>
                        </div>
                    )}
                    <span className={`text-[10px] font-semibold uppercase tracking-wider ${isUser ? 'text-blue-300/60' : 'text-purple-300/60'}`}>
                        {isUser ? 'You' : 'ShopEase AI'}
                    </span>
                    {timestamp && (
                        <span className="text-[10px] text-white/20 ml-auto">{formatTime(timestamp)}</span>
                    )}
                </div>
                <p className="text-sm text-white/85 leading-relaxed whitespace-pre-wrap">{content}</p>
            </div>
        </div>
    );
}
