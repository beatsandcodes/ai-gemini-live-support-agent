import Head from 'next/head';
import VoiceAgentWidget from '../components/VoiceAgentWidget';

export default function Home() {
    return (
        <>
            <Head>
                <title>ShopEase AI Support — Voice Customer Service Agent</title>
                <meta
                    name="description"
                    content="Talk to our AI-powered customer support agent. Get instant help with orders, refunds, and questions using natural voice conversation powered by Google Gemini."
                />
                <meta name="viewport" content="width=device-width, initial-scale=1" />
                <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🤖</text></svg>" />
            </Head>

            {/* ── Ambient Background ── */}
            <div className="ambient-bg" />

            <main className="relative z-10 min-h-screen flex flex-col">
                {/* ── Navbar ── */}
                <nav className="flex items-center justify-between px-6 lg:px-10 py-5 border-b border-white/5">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-600 to-blue-500 flex items-center justify-center shadow-lg shadow-purple-500/20">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                                <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                                <line x1="12" y1="19" x2="12" y2="23" />
                                <line x1="8" y1="23" x2="16" y2="23" />
                            </svg>
                        </div>
                        <div>
                            <h1 className="font-display text-lg font-bold text-white tracking-tight">
                                ShopEase
                            </h1>
                            <p className="text-[11px] text-white/30 font-medium tracking-wide uppercase">
                                AI Customer Support
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-4">
                        <span className="hidden sm:inline-flex items-center gap-2 text-xs text-white/30 bg-white/5 px-3 py-1.5 rounded-lg border border-white/5">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
                            </svg>
                            Powered by Gemini
                        </span>
                    </div>
                </nav>

                {/* ── Hero Section ── */}
                <section className="text-center pt-8 pb-4 px-6">
                    <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-300 text-xs font-medium mb-5 animate-fade-in">
                        <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse" />
                        Real-Time Voice AI Agent
                    </div>
                    <h2 className="font-display text-3xl sm:text-4xl lg:text-5xl font-extrabold mb-3 tracking-tight">
                        <span className="text-white">AI Customer </span>
                        <span className="text-gradient">Support</span>
                    </h2>
                    <p className="text-white/40 text-sm sm:text-base max-w-xl mx-auto leading-relaxed">
                        Speak naturally with our AI agent to check orders, request refunds, or get instant answers.
                        Powered by Google Gemini Live API.
                    </p>
                </section>

                {/* ── Voice Agent Widget ── */}
                <section className="flex-1 px-4 sm:px-6 lg:px-10 pb-8 pt-2">
                    <VoiceAgentWidget />
                </section>

                {/* ── Footer ── */}
                <footer className="border-t border-white/5 px-6 py-4">
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-white/20">
                        <p>Voice AI Customer Support Agent — Gemini Live Agent Challenge</p>
                        <div className="flex items-center gap-4">
                            <span className="flex items-center gap-1.5">
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                                </svg>
                                Secure Connection
                            </span>
                            <span>Built with Gemini 2.0 Flash</span>
                        </div>
                    </div>
                </footer>
            </main>
        </>
    );
}
