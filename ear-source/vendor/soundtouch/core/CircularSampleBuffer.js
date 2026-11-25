const SAMPLES_PER_FRAME = 2;
export default class CircularSampleBuffer {
    _buffer;
    _capacityFrames;
    _readFrame;
    _frameCount;
    constructor(capacityFrames = 2048){
        const normalizedCapacity = Math.max(1, Math.floor(capacityFrames));
        this._capacityFrames = normalizedCapacity;
        this._buffer = new Float32Array(normalizedCapacity * SAMPLES_PER_FRAME);
        this._readFrame = 0;
        this._frameCount = 0;
    }
    get capacityFrames() {
        return this._capacityFrames;
    }
    get frameCount() {
        return this._frameCount;
    }
    clear() {
        this._readFrame = 0;
        this._frameCount = 0;
    }
    ensureCapacity(minCapacityFrames) {
        const normalizedMinCapacityFrames = Math.max(0, Math.floor(minCapacityFrames));
        if (normalizedMinCapacityFrames <= this._capacityFrames) {
            return;
        }
        const nextCapacity = Math.max(normalizedMinCapacityFrames, this._capacityFrames * 2, this._capacityFrames + 1024);
        const nextBuffer = new Float32Array(nextCapacity * SAMPLES_PER_FRAME);
        for(let frame = 0; frame < this._frameCount; frame += 1){
            const sourceFrame = (this._readFrame + frame) % this._capacityFrames;
            const sourceIndex = sourceFrame * SAMPLES_PER_FRAME;
            const destIndex = frame * SAMPLES_PER_FRAME;
            nextBuffer[destIndex] = this._buffer[sourceIndex];
            nextBuffer[destIndex + 1] = this._buffer[sourceIndex + 1];
        }
        this._buffer = nextBuffer;
        this._capacityFrames = nextCapacity;
        this._readFrame = 0;
    }
    pushSamples(source, sourceFrameOffset = 0, frameCount = 0) {
        const normalizedSourceFrameOffset = Math.max(0, Math.floor(sourceFrameOffset));
        const sourceStartSample = normalizedSourceFrameOffset * SAMPLES_PER_FRAME;
        const availableFrames = Math.max(0, Math.floor((source.length - sourceStartSample) / SAMPLES_PER_FRAME));
        const requestedFrames = frameCount > 0 ? Math.floor(frameCount) : 0;
        const framesToWrite = requestedFrames > 0 ? Math.min(requestedFrames, availableFrames) : availableFrames;
        if (framesToWrite <= 0) {
            return;
        }
        this.ensureCapacity(this._frameCount + framesToWrite);
        const writeFrame = (this._readFrame + this._frameCount) % this._capacityFrames;
        for(let frame = 0; frame < framesToWrite; frame += 1){
            const sourceIndex = sourceStartSample + frame * SAMPLES_PER_FRAME;
            const destFrame = (writeFrame + frame) % this._capacityFrames;
            const destIndex = destFrame * SAMPLES_PER_FRAME;
            this._buffer[destIndex] = source[sourceIndex];
            this._buffer[destIndex + 1] = source[sourceIndex + 1];
        }
        this._frameCount += framesToWrite;
    }
    putSamples(source, sourceFrameOffset = 0, frameCount = 0) {
        this.pushSamples(source, sourceFrameOffset, frameCount);
    }
    extract(target, sourceFrameOffset = 0, frameCount = 0, consume = false) {
        const normalizedSourceFrameOffset = Math.max(0, Math.floor(sourceFrameOffset));
        const requestedFrames = frameCount > 0 ? Math.floor(frameCount) : 0;
        const framesAvailable = Math.max(0, this._frameCount - normalizedSourceFrameOffset);
        const framesToRead = requestedFrames > 0 ? Math.min(requestedFrames, framesAvailable) : framesAvailable;
        if (framesToRead <= 0) {
            return 0;
        }
        for(let frame = 0; frame < framesToRead; frame += 1){
            const sourceFrame = (this._readFrame + normalizedSourceFrameOffset + frame) % this._capacityFrames;
            const sourceIndex = sourceFrame * SAMPLES_PER_FRAME;
            const targetIndex = frame * SAMPLES_PER_FRAME;
            target[targetIndex] = this._buffer[sourceIndex];
            target[targetIndex + 1] = this._buffer[sourceIndex + 1];
        }
        if (consume) {
            const framesToDrop = normalizedSourceFrameOffset + framesToRead;
            this.dropFrames(framesToDrop);
        }
        return framesToRead;
    }
    readSample(sampleIndex) {
        const normalizedSampleIndex = Math.max(0, Math.floor(sampleIndex));
        const frameOffset = Math.floor(normalizedSampleIndex / SAMPLES_PER_FRAME);
        if (frameOffset >= this._frameCount) {
            return 0;
        }
        const channelOffset = normalizedSampleIndex % SAMPLES_PER_FRAME;
        const sourceFrame = (this._readFrame + frameOffset) % this._capacityFrames;
        const sourceIndex = sourceFrame * SAMPLES_PER_FRAME + channelOffset;
        return this._buffer[sourceIndex] ?? 0;
    }
    dropFrames(frameCount) {
        const normalizedFrameCount = Math.max(0, Math.floor(frameCount));
        const framesToDrop = Math.max(0, Math.min(normalizedFrameCount, this._frameCount));
        if (framesToDrop === 0) {
            return 0;
        }
        this._readFrame = (this._readFrame + framesToDrop) % this._capacityFrames;
        this._frameCount -= framesToDrop;
        if (this._frameCount === 0) {
            this._readFrame = 0;
        }
        return framesToDrop;
    }
    receive(frameCount = this._frameCount) {
        this.dropFrames(frameCount);
    }
}
