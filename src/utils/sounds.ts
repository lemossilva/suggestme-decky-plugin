import { logger } from "./logger";

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext {
    if (!audioCtx || audioCtx.state === 'closed') {
        audioCtx = new AudioContext();
    }
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
    return audioCtx;
}

export function playWheelClick(volume: number = 0.3): void {
    try {
        const ctx = getAudioContext();
        const now = ctx.currentTime;
        const clampedVol = Math.max(0.05, Math.min(1, volume));

        const bufferSize = Math.floor(ctx.sampleRate * 0.012);
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);

        for (let i = 0; i < bufferSize; i++) {
            const t = i / bufferSize;
            const envelope = Math.exp(-t * 25);
            const noise = (Math.random() * 2 - 1) * 0.3;
            const click = Math.sin(2 * Math.PI * 3500 * t) * 0.7;
            data[i] = (click + noise) * envelope;
        }

        const source = ctx.createBufferSource();
        source.buffer = buffer;

        const gain = ctx.createGain();
        gain.gain.setValueAtTime(clampedVol * 0.8, now);

        const filter = ctx.createBiquadFilter();
        filter.type = 'highpass';
        filter.frequency.setValueAtTime(800, now);

        source.connect(filter);
        filter.connect(gain);
        gain.connect(ctx.destination);

        source.start(now);
    } catch (e) {
        logger.error('[SuggestMe] Failed to play wheel click:', e);
    }
}

export function cleanupAudio(): void {
    if (audioCtx && audioCtx.state !== 'closed') {
        audioCtx.close();
        audioCtx = null;
    }
}
