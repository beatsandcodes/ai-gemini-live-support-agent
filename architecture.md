# Architecture — Voice AI Customer Support Agent

## System Overview

This project implements a **real-time voice AI customer support agent** powered by
Google's **Gemini 2.0 Flash** model via the **Gemini Live API** (Multimodal Live API).
Users speak naturally through their browser microphone, and the AI agent responds with
both text and synthesized speech — creating a seamless, human-like support experience.

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         USER'S BROWSER                                 │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                    Next.js Frontend                             │    │
│  │                                                                 │    │
│  │  ┌──────────────┐   ┌─────────────────┐   ┌───────────────┐   │    │
│  │  │  index.js     │   │ VoiceAgentWidget│   │  ChatWindow   │   │    │
│  │  │  (Main Page)  │──▶│ (Voice Control) │──▶│  (Messages)   │   │    │
│  │  └──────────────┘   └────────┬────────┘   └───────────────┘   │    │
│  │                              │                                  │    │
│  │                   ┌──────────┴──────────┐                      │    │
│  │                   │   Web Audio API      │                      │    │
│  │                   │  ┌────────────────┐  │                      │    │
│  │                   │  │ Mic Capture     │  │                      │    │
│  │                   │  │ (16kHz PCM)     │  │                      │    │
│  │                   │  ├────────────────┤  │                      │    │
│  │                   │  │ Audio Playback  │  │                      │    │
│  │                   │  │ (24kHz PCM)     │  │                      │    │
│  │                   │  └────────────────┘  │                      │    │
│  │                   └──────────┬──────────┘                      │    │
│  └──────────────────────────────┼─────────────────────────────────┘    │
│                                 │                                       │
│                        WebSocket (ws://)                                │
│                       Base64 Audio Chunks                              │
│                       JSON Control Messages                            │
└─────────────────────────────────┼───────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                     GOOGLE CLOUD (Cloud Run)                            │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                 Node.js Backend Server                          │    │
│  │                                                                 │    │
│  │  ┌─────────────────────────────────────────────────────────┐   │    │
│  │  │                   server.js                              │   │    │
│  │  │  • Express HTTP Server (health checks, API info)        │   │    │
│  │  │  • WebSocket Server (real-time audio/text streaming)    │   │    │
│  │  │  • Session management per client connection             │   │    │
│  │  └────────────────────────┬────────────────────────────────┘   │    │
│  │                           │                                     │    │
│  │  ┌────────────────────────▼────────────────────────────────┐   │    │
│  │  │                   agent.js                               │   │    │
│  │  │  • SupportAgent class                                   │   │    │
│  │  │  • Gemini Live API session management                   │   │    │
│  │  │  • Async message loop (audio, text, tool calls)         │   │    │
│  │  │  • Tool execution & result forwarding                   │   │    │
│  │  │  • System prompt & voice configuration                  │   │    │
│  │  └────────────────────────┬────────────────────────────────┘   │    │
│  │                           │                                     │    │
│  │  ┌────────────────────────▼────────────────────────────────┐   │    │
│  │  │               Tool Layer                                 │   │    │
│  │  │  ┌──────────────┐ ┌───────────┐ ┌─────────────────┐    │   │    │
│  │  │  │ orderLookup  │ │refundTool │ │    faqTool      │    │   │    │
│  │  │  │ .js          │ │.js        │ │    .js          │    │   │    │
│  │  │  │              │ │           │ │                 │    │   │    │
│  │  │  │ checkOrder() │ │process    │ │ faq()           │    │   │    │
│  │  │  │              │ │Refund()   │ │ keyword match   │    │   │    │
│  │  │  └──────┬───────┘ └─────┬─────┘ └────────┬────────┘    │   │    │
│  │  │         │               │                │              │   │    │
│  │  │         └───────────────┼────────────────┘              │   │    │
│  │  │                         │                                │   │    │
│  │  │              ┌──────────▼──────────┐                    │   │    │
│  │  │              │   orders.json       │                    │   │    │
│  │  │              │   (Order Database)  │                    │   │    │
│  │  │              └────────────────────┘                    │   │    │
│  │  └─────────────────────────────────────────────────────────┘   │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                         │
└──────────────────────────────┬──────────────────────────────────────────┘
                               │
                    Gemini Live API (WebSocket)
                    Bidirectional Streaming
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                     GOOGLE AI PLATFORM                                  │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │            Gemini 2.0 Flash (Multimodal Live API)               │    │
│  │                                                                 │    │
│  │  • Real-time speech-to-text (audio input processing)           │    │
│  │  • Natural language understanding & intent detection           │    │
│  │  • Function calling / tool use                                  │    │
│  │  • Response generation                                          │    │
│  │  • Text-to-speech synthesis (audio output at 24kHz)            │    │
│  │  • Voice: Kore (natural, professional tone)                    │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Data Flow

### 1. Voice Input Flow

```
User speaks → Browser Microphone
    → Web Audio API captures PCM (16kHz, mono, 16-bit)
    → Base64 encode
    → WebSocket message { type: "audio", data: "<base64>" }
    → Backend server.js receives
    → agent.js forwards to Gemini Live API via sendRealtimeInput()
    → Gemini processes speech-to-text internally
```

### 2. AI Processing Flow

```
Gemini receives audio
    → Transcribes speech internally
    → Understands intent (NLU)
    → Decides whether to call a tool
    ├── If tool needed:
    │   → Sends toolCall message to agent.js
    │   → agent.js executes tool (checkOrder / processRefund / faq)
    │   → Sends tool result back to Gemini via sendToolResponse()
    │   → Gemini incorporates result into response
    └── Generates response
        → Sends audio response (24kHz PCM)
        → Sends text transcript (optional)
```

### 3. Voice Output Flow

```
Gemini generates audio response
    → agent.js receives via async iterator
    → server.js forwards to client: { type: "audio", data: "<base64>", mimeType: "audio/pcm" }
    → Frontend queues audio chunks
    → Decodes base64 → Int16 PCM → Float32
    → AudioContext plays at 24kHz
    → User hears the AI agent speak
```

---

## Component Details

### Frontend Components

| Component | File | Purpose |
|-----------|------|---------|
| Main Page | `pages/index.js` | Layout, hero section, navbar, footer |
| Voice Widget | `components/VoiceAgentWidget.js` | Mic capture, WS connection, audio playback, UI controls |
| Chat Window | `components/ChatWindow.js` | Message display, typing indicator, status |

### Backend Modules

| Module | File | Purpose |
|--------|------|---------|
| HTTP/WS Server | `server.js` | Express + WebSocket server, session management |
| AI Agent | `agent.js` | Gemini Live API integration, tool orchestration |
| Order Tool | `tools/orderLookup.js` | Order status lookup from JSON database |
| Refund Tool | `tools/refundTool.js` | Refund request processing |
| FAQ Tool | `tools/faqTool.js` | FAQ keyword matching and responses |

---

## Tool Calling Architecture

The agent uses Gemini's built-in **function calling** capability. Tools are declared
as function schemas when creating the Live API session:

```
Agent Session Config
  └── tools: [{ functionDeclarations: [...] }]
        ├── check_order(order_id) → Order status from orders.json
        ├── process_refund(order_id) → Simulated refund processing
        └── faq(question) → Keyword-matched FAQ responses
```

When Gemini determines a tool is needed:
1. It sends a `toolCall` message with function name and arguments
2. The agent executes the corresponding function locally
3. The result is sent back via `sendToolResponse()`
4. Gemini incorporates the result into its spoken response

---

## Security Considerations

- **API Key**: Stored as environment variable, never exposed to frontend
- **CORS**: Configurable origin restriction
- **Cloud Run**: Secrets manager integration for API key
- **WebSocket**: Per-connection session isolation
- **Non-root Docker**: Container runs as non-root user

---

## Deployment Architecture

```
┌──────────────┐     ┌──────────────┐     ┌──────────────────┐
│   Frontend   │     │  Cloud Run   │     │  Gemini Live API │
│  (Vercel /   │────▶│  (Backend)   │────▶│  (Google AI)     │
│   Static)    │     │  Port 8080   │     │                  │
└──────────────┘     └──────────────┘     └──────────────────┘
                            │
                     ┌──────┴──────┐
                     │  Secret     │
                     │  Manager    │
                     │  (API Key)  │
                     └─────────────┘
```

---

## Technology Choices

| Requirement | Choice | Why |
|------------|--------|-----|
| AI Model | Gemini 2.0 Flash (Live API) | Real-time multimodal streaming, built-in voice I/O |
| SDK | @google/genai | Official Google Gen AI SDK with Live API support |
| Backend Runtime | Node.js | Excellent WebSocket support, async/await for streaming |
| Frontend | Next.js 14 | Server rendering, modern React, great DX |
| Styling | TailwindCSS | Rapid UI development with design tokens |
| Real-time Comm | WebSocket (ws) | Low-latency bidirectional audio streaming |
| Audio Capture | Web Audio API | Direct PCM access for real-time streaming |
| Deployment | Cloud Run | Serverless containers with WebSocket support |
