/**
 * AudioWorkletProcessor for capturing raw PCM audio data.
 * This runs in a separate thread, avoiding the main thread blocking
 * issues associated with the deprecated ScriptProcessorNode.
 */
class PCMProcessor extends AudioWorkletProcessor {
    constructor() {
        super();
        this.bufferSize = 4096;
        this.buffer = new Float32Array(this.bufferSize);
        this.bytesWritten = 0;
    }

    process(inputs, outputs, parameters) {
        const input = inputs[0];
        if (input.length > 0) {
            const channelData = input[0];

            for (let i = 0; i < channelData.length; i++) {
                this.buffer[this.bytesWritten++] = channelData[i];

                if (this.bytesWritten >= this.bufferSize) {
                    // Send the full chunk to the main thread
                    this.port.postMessage(this.buffer);

                    // Reset buffer
                    this.buffer = new Float32Array(this.bufferSize);
                    this.bytesWritten = 0;
                }
            }
        }

        // Keep the processor alive
        return true;
    }
}

registerProcessor('pcm-processor', PCMProcessor);
