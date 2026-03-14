const { GoogleGenAI, Modality } = require('@google/genai');
const { checkOrder } = require('./tools/orderLookup');
const { processRefund } = require('./tools/refundTool');
const { faq } = require('./tools/faqTool');

// ─── System Instruction ────────────────────────────────────────────────────────
const SYSTEM_INSTRUCTION = `You are a professional and friendly AI customer support agent for ShopEase, a popular online retail store.

Your role is to assist customers with their orders, process refund requests, and answer common questions about store policies.

PERSONALITY:
- Warm, empathetic, and professional
- Concise but thorough in responses
- Always address the customer respectfully
- Show genuine care about resolving their issues

GUIDELINES:
1. When a customer mentions an order number, ALWAYS use the check_order tool to look up the current status
2. When a customer requests a refund, use the process_refund tool with their order ID
3. For general questions about policies, shipping, returns, etc., use the faq tool
4. Always confirm the action you're taking before proceeding
5. If you cannot find information or help with something, suggest contacting support@shopease.com
6. Keep responses natural and conversational since you are speaking to the customer via voice
7. Do not use markdown formatting, bullet points, or special characters in your responses since they will be spoken aloud
8. Use natural speech patterns like "Let me check that for you" while processing

IMPORTANT: You are speaking to customers via voice. Keep your responses concise and natural-sounding. Avoid long lists or complex formatting.`;

// ─── Tool Declarations for Gemini ──────────────────────────────────────────────
const TOOL_DECLARATIONS = [
    {
        name: 'check_order',
        description:
            'Look up the status of a customer order by order ID. Use this when a customer asks about their order status, delivery time, shipping information, or tracking number. The order_id should be just the number.',
        parameters: {
            type: 'object',
            properties: {
                order_id: {
                    type: 'string',
                    description: 'The numeric order ID to look up (e.g., "1452")',
                },
            },
            required: ['order_id'],
        },
    },
    {
        name: 'process_refund',
        description:
            'Process a refund request for a customer order. Use this when a customer explicitly requests a refund or wants their money back for an order.',
        parameters: {
            type: 'object',
            properties: {
                order_id: {
                    type: 'string',
                    description: 'The order ID to process a refund for',
                },
            },
            required: ['order_id'],
        },
    },
    {
        name: 'faq',
        description:
            'Answer frequently asked questions about store policies, shipping times, return policy, payment methods, warranty, account issues, and contacting support. Use this for general questions not about a specific order.',
        parameters: {
            type: 'object',
            properties: {
                question: {
                    type: 'string',
                    description: 'The customer question or topic to look up (e.g., "return policy", "shipping times")',
                },
            },
            required: ['question'],
        },
    },
];

// ─── Tool Executor Map ─────────────────────────────────────────────────────────
const TOOL_EXECUTORS = {
    check_order: (args) => checkOrder(args.order_id),
    process_refund: (args) => processRefund(args.order_id),
    faq: (args) => faq(args.question),
};

// ─── Support Agent Class ───────────────────────────────────────────────────────
class SupportAgent {
    /**
     * @param {string} apiKey - Google Gemini API key
     */
    constructor(apiKey) {
        this.ai = new GoogleGenAI({ apiKey });
        this.session = null;
        this.isConnected = false;
    }

    /**
     * Connect to the Gemini Live API and start a new agent session.
     * @param {object} callbacks - Event callbacks
     * @param {function} callbacks.onText - Called with text content from the model
     * @param {function} callbacks.onAudio - Called with (base64Data, mimeType) for audio responses
     * @param {function} callbacks.onTurnComplete - Called when the model finishes its turn
     * @param {function} callbacks.onInterrupted - Called when the model's response is interrupted
     * @param {function} callbacks.onError - Called with error objects
     * @param {function} callbacks.onClose - Called when the session closes
     * @param {function} callbacks.onToolCall - Called with tool execution info for logging
     * @returns {boolean} Whether connection was successful
     */
    async connect(callbacks) {
        const {
            onText,
            onAudio,
            onTurnComplete,
            onInterrupted,
            onError,
            onClose,
            onToolCall,
        } = callbacks;

        try {
            console.log('[Agent] Connecting to Gemini Live API...');

            this.session = await this.ai.live.connect({
                model: 'gemini-2.5-flash-native-audio-latest',
                config: {
                    responseModalities: [Modality.AUDIO],
                    systemInstruction: {
                        parts: [{ text: SYSTEM_INSTRUCTION }],
                    },
                    tools: [{ functionDeclarations: TOOL_DECLARATIONS }],
                    speechConfig: {
                        voiceConfig: {
                            prebuiltVoiceConfig: {
                                voiceName: 'Kore',
                            },
                        },
                    },
                },
                callbacks: {
                    onmessage: (message) => this._handleLiveMessage(message, callbacks),
                    onclose: () => {
                        this.isConnected = false;
                        console.log('[Agent] Session ended');
                        onClose();
                    },
                    onerror: (error) => {
                        console.error('[Agent] Session error:', error);
                        onError(error);
                    }
                }
            });

            this.isConnected = true;
            console.log('[Agent] Connected to Gemini Live API successfully');

            return true;
        } catch (error) {
            console.error('[Agent] Failed to connect:', error.message);
            onError(error);
            return false;
        }
    }

    /**
     * Process an incoming message from the Gemini Live session.
     * Handles text responses, audio responses, and tool calls.
     */
    _handleLiveMessage(message, callbacks) {
        const { onText, onAudio, onTurnComplete, onInterrupted, onError, onClose, onToolCall } = callbacks;

        try {
            // ── Handle Server Content (text & audio responses) ──
            if (message.serverContent) {
                const modelTurn = message.serverContent.modelTurn;

                if (modelTurn && modelTurn.parts) {
                    for (const part of modelTurn.parts) {
                        if (part.text) {
                            onText(part.text);
                        }
                        if (part.inlineData) {
                            onAudio(part.inlineData.data, part.inlineData.mimeType);
                        }
                    }
                }

                // Check if model was interrupted (user started speaking)
                if (message.serverContent.interrupted) {
                    console.log('[Agent] Response interrupted by user');
                    if (onInterrupted) onInterrupted();
                }

                // Check if the model's turn is complete
                if (message.serverContent.turnComplete) {
                    if (onTurnComplete) onTurnComplete();
                }
            }

            // ── Handle Tool Calls ──
            if (message.toolCall) {
                console.log('[Agent] Tool call received:', JSON.stringify(message.toolCall));

                const functionResponses = [];

                for (const fc of message.toolCall.functionCalls) {
                    console.log(`[Agent] Executing tool: ${fc.name}`, fc.args);

                    const executor = TOOL_EXECUTORS[fc.name];
                    let result;

                    if (executor) {
                        try {
                            result = executor(fc.args);
                            console.log(`[Agent] Tool ${fc.name} result:`, JSON.stringify(result));
                        } catch (err) {
                            console.error(`[Agent] Tool ${fc.name} error:`, err.message);
                            result = { success: false, message: `Error executing ${fc.name}: ${err.message}` };
                        }
                    } else {
                        result = { success: false, message: `Unknown tool: ${fc.name}` };
                    }

                    // Notify about tool execution for logging
                    if (onToolCall) {
                        onToolCall({
                            name: fc.name,
                            args: fc.args,
                            result: result,
                        });
                    }

                    functionResponses.push({
                        id: fc.id,
                        name: fc.name,
                        response: result,
                    });
                }

                // Send tool results back to Gemini
                console.log('[Agent] Sending tool responses back to Gemini');
                if (this.session && this.isConnected) {
                    this.session.sendToolResponse({ functionResponses });
                }
            }

            // ── Handle Setup Complete ──
            if (message.setupComplete) {
                console.log('[Agent] Session setup complete');
            }
        } catch (error) {
            if (this.isConnected) {
                console.error('[Agent] Message processing error:', error.message);
                onError(error);
            }
        }
    }

    /**
     * Send audio data to the Gemini Live session.
     * @param {string} base64Data - Base64-encoded PCM audio data
     */
    sendAudio(base64Data) {
        if (this.session && this.isConnected) {
            this.session.sendRealtimeInput({
                media: {
                    mimeType: 'audio/pcm;rate=16000',
                    data: base64Data,
                },
            });
        }
    }

    /**
     * Send a text message to the Gemini Live session.
     * @param {string} text - The text message to send
     */
    sendText(text) {
        if (this.session && this.isConnected) {
            this.session.sendClientContent({
                turns: [{ role: 'user', parts: [{ text }] }],
                turnComplete: true,
            });
        }
    }

    /**
     * Disconnect from the Gemini Live session.
     */
    disconnect() {
        console.log('[Agent] Disconnecting...');
        this.isConnected = false;
        if (this.session) {
            try {
                this.session.close();
            } catch (e) {
                // Ignore close errors
            }
            this.session = null;
        }
    }
}

module.exports = { SupportAgent };
