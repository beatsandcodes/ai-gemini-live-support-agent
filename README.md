# 🤖 Voice AI Customer Support Agent

### Gemini Live Agent Challenge Submission

A **real-time multimodal AI customer support agent** that users can talk to naturally through their browser. Built with Google's **Gemini 2.0 Flash** model and the **Multimodal Live API** for instant voice-to-voice conversations.

![Gemini](https://img.shields.io/badge/Gemini-2.0_Flash-4285F4?style=for-the-badge&logo=google&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-20+-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)
![Next.js](https://img.shields.io/badge/Next.js-14-000000?style=for-the-badge&logo=nextdotjs&logoColor=white)
![Cloud Run](https://img.shields.io/badge/Cloud_Run-Deployed-4285F4?style=for-the-badge&logo=googlecloud&logoColor=white)

---

## 🎯 Project Overview

This project demonstrates a **production-ready voice AI agent** for customer support. Users open a web page, click "Talk to Support," and have a natural voice conversation with an AI that can:

- 🎤 **Listen** to the user through their microphone in real time
- 🧠 **Understand** the request using Gemini's multimodal capabilities
- 🔧 **Execute tools** (check orders, process refunds, answer FAQs)
- 🔊 **Respond with natural voice** synthesized by Gemini
- 💬 **Display** the conversation in a beautiful chat interface

### Key Differentiators

- **True real-time streaming** — audio is streamed continuously, not recorded-and-sent
- **Gemini Live API** — leverages bidirectional WebSocket for sub-second latency
- **Function calling** — agent autonomously decides when to call backend tools
- **Interruption support** — user can interrupt the AI mid-response, just like a real conversation

---

## 🏗️ Architecture

```
User Browser ←→ Next.js Frontend ←→ Node.js Backend ←→ Gemini Live API
                                          ↓
                                    Tool Layer
                                (Orders / Refunds / FAQ)
```

See [architecture.md](./architecture.md) for the full system design with detailed diagrams.

---

## 📁 Project Structure

```
ai-gemini-live-support-agent/
├── frontend/                    # Next.js 14 Frontend
│   ├── pages/
│   │   ├── _app.js             # App wrapper
│   │   └── index.js            # Main page
│   ├── components/
│   │   ├── VoiceAgentWidget.js # Voice capture & playback
│   │   └── ChatWindow.js      # Chat message display
│   ├── styles/
│   │   └── globals.css         # TailwindCSS + custom styles
│   ├── package.json
│   ├── next.config.js
│   ├── tailwind.config.js
│   └── postcss.config.js
│
├── backend/                     # Node.js Backend
│   ├── server.js               # Express + WebSocket server
│   ├── agent.js                # Gemini Live API agent
│   ├── tools/
│   │   ├── orderLookup.js      # Order status lookup
│   │   ├── refundTool.js       # Refund processing
│   │   └── faqTool.js          # FAQ knowledge base
│   ├── data/
│   │   └── orders.json         # Sample order database
│   ├── package.json
│   └── .env.example
│
├── deployment/
│   └── cloudrun.yaml           # Cloud Run deployment config
│
├── Dockerfile                   # Multi-stage Docker build
├── .dockerignore
├── .gitignore
├── architecture.md              # System architecture document
└── README.md                    # This file
```

---

## 🚀 Quick Start

### Prerequisites

- **Node.js 18+** installed
- **Google Gemini API Key** ([Get one here](https://aistudio.google.com/apikey))
- A modern browser with microphone support (Chrome recommended)

### 1. Clone the repository

```bash
git clone https://github.com/your-username/ai-gemini-live-support-agent.git
cd ai-gemini-live-support-agent
```

### 2. Set up the Backend

```bash
cd backend

# Install dependencies
npm install

# Create environment file
cp .env.example .env

# Edit .env and add your Gemini API key
# GEMINI_API_KEY=your_actual_api_key_here

# Start the backend server
npm start
```

The backend will start on `http://localhost:8080`.

### 3. Set up the Frontend

```bash
cd frontend

# Install dependencies
npm install

# Start the development server
npm run dev
```

The frontend will start on `http://localhost:3000`.

### 4. Start talking!

1. Open `http://localhost:3000` in Chrome
2. Click the **microphone button** ("Talk to Support")
3. Allow microphone access when prompted
4. Start speaking naturally — ask about orders, request refunds, or ask questions

---

## 🎮 Demo Scenario

Try these conversations with the agent:

### Check Order Status
> **You:** "Where is my order 1452?"
>
> **AI:** "Let me check that for you. Your order 1452 was shipped yesterday with tracking number TRK-998877 and should arrive tomorrow."

### Request a Refund
> **You:** "I want a refund for order 7831."
>
> **AI:** "I'll process that refund for you right away. Your refund for order 7831 has been submitted. The amount of $124.50 will be credited back within 3-5 business days."

### Ask a FAQ
> **You:** "What's your return policy?"
>
> **AI:** "Our return policy allows returns within 30 days of delivery. Items must be in their original condition and packaging..."

### Multi-turn Conversation
> **You:** "Check order 5510"
>
> **AI:** "Your order 5510 was shipped and should arrive in 2 days..."
>
> **You:** "Actually, I'd like a refund for that"
>
> **AI:** "I'll process the refund for order 5510..."

---

## 🛠️ Available Tools

| Tool | Function | Description |
|------|----------|-------------|
| `check_order` | `checkOrder(orderId)` | Looks up order status, tracking, delivery estimates |
| `process_refund` | `processRefund(orderId)` | Processes refund request, generates refund ID |
| `faq` | `faq(question)` | Answers questions about policies, shipping, support |

### Sample Orders

| Order ID | Status | Items | Total |
|----------|--------|-------|-------|
| 1452 | Shipped | Wireless Headphones, Phone Case | $89.99 |
| 7831 | Processing | Laptop Stand, USB-C Hub | $124.50 |
| 2290 | Delivered | Mechanical Keyboard | $159.00 |
| 3345 | Cancelled | Monitor Arm | $49.99 |
| 5510 | Shipped | Webcam HD Pro, Ring Light | $210.00 |

---

## ☁️ Google Cloud Deployment

### Prerequisites

- [Google Cloud SDK](https://cloud.google.com/sdk/docs/install) installed
- A Google Cloud project with billing enabled
- Cloud Run API enabled

### Step 1: Configure Google Cloud

```bash
# Set your project ID
gcloud config set project YOUR_PROJECT_ID

# Enable required APIs
gcloud services enable run.googleapis.com
gcloud services enable secretmanager.googleapis.com
gcloud services enable artifactregistry.googleapis.com
```

### Step 2: Store API Key as Secret

```bash
# Create the secret
echo -n "your_gemini_api_key" | \
  gcloud secrets create gemini-api-key --data-file=-

# Grant Cloud Run access to the secret
gcloud secrets add-iam-policy-binding gemini-api-key \
  --member="serviceAccount:YOUR_PROJECT_NUMBER-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

### Step 3: Build and Deploy

```bash
# Build the container image
gcloud builds submit --tag gcr.io/YOUR_PROJECT_ID/ai-gemini-live-support-agent

# Deploy to Cloud Run
gcloud run deploy ai-gemini-live-support-agent \
  --image gcr.io/YOUR_PROJECT_ID/ai-gemini-live-support-agent \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --set-secrets="GEMINI_API_KEY=gemini-api-key:latest" \
  --session-affinity \
  --min-instances 0 \
  --max-instances 10
```

### Step 4: Update Frontend

Update `NEXT_PUBLIC_WS_URL` in the frontend to point to your Cloud Run URL:

```
wss://ai-gemini-live-support-agent-xxxxx.run.app/ws
```

Deploy the frontend to **Vercel**, **Cloud Run**, or any static hosting provider.

---

## 🏆 Challenge Compliance

| Requirement | Implementation | ✅ |
|------------|---------------|---|
| Use a Gemini model | Gemini 2.5 Flash Native Audio (`gemini-2.5-flash-native-audio-latest`) | ✅ |
| Use Google GenAI SDK | @google/genai with Live API | ✅ |
| Run backend on Google Cloud | Cloud Run with Dockerfile + cloudrun.yaml | ✅ |
| Multimodal interaction | Voice input (mic) + Voice output (TTS) | ✅ |
| Real-time interactive agent | Bidirectional WebSocket streaming | ✅ |

---

## 🧪 Tech Stack

### Frontend
- **Next.js 14** — React framework with SSR
- **TailwindCSS** — Utility-first styling
- **Web Audio API** — PCM microphone capture at 16kHz
- **WebSocket** — Real-time bidirectional communication

### Backend
- **Node.js** — Async runtime for streaming
- **Express** — HTTP server for health checks
- **ws** — WebSocket server for real-time audio
- **@google/genai** — Official Google Gen AI SDK

### Google Cloud
- **Cloud Run** — Serverless container hosting
- **Secret Manager** — Secure API key storage
- **Gemini Live API** — Real-time multimodal AI

---

## 📝 Devpost Submission Checklist

- [x] Project uses a Gemini model (Gemini 2.0 Flash)
- [x] Project uses Google GenAI SDK (@google/genai)
- [x] Backend runs on Google Cloud (Cloud Run)
- [x] Demonstrates multimodal interaction (voice ↔ voice)
- [x] Shows real-time interactive agent behavior
- [x] Includes Dockerfile for deployment
- [x] Includes Cloud Run deployment configuration
- [x] Includes architecture documentation
- [x] Public repository with complete source code
- [x] Demo video showing live voice conversation
- [x] README with setup and deployment instructions

---

## 📄 License

MIT License — See [LICENSE](./LICENSE) for details.

---

## 🙏 Acknowledgments

- **Google Gemini Team** for the Multimodal Live API
- **Google Cloud** for Cloud Run infrastructure
- **Gemini Live Agent Challenge** for the inspiration

---

<p align="center">
  Built with ❤️ for the <strong>Gemini Live Agent Challenge</strong>
</p>
