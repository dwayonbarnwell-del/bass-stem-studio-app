const BYTES_PER_SAMPLE = 4;
const SAMPLES_PER_FRAME = 2;
const BYTES_PER_FRAME = BYTES_PER_SAMPLE * SAMPLES_PER_FRAME;
const DEFAULT_MAX_FRAMES = 131072;
export default class FifoSampleBuffer {
    _buffer;
    _vector;
    _position;
    _frameCount;
    constructor(maxFrames = DEFAULT_MAX_FRAMES){
        this._buffer = new ArrayBuffer(0, {
            maxByteLength: maxFrames * BYTES_PER_FRAME
        });
        this._vector = new Float32Array(this._buffer);
        this._position = 0;
        this._frameCount = 0;
    }
    get vector() {
        return this._vector;
    }
    get position() {
        return this._position;
    }
    get startIndex() {
        return this._position * 2;
    }
    get frameCount() {
        return this._frameCount;
    }
    get endIndex() {
        return (this._position + this._frameCount) * 2;
    }
    clear() {
        this._vector.fill(0);
        this._position = 0;
        this._frameCount = 0;
    }
    put(numFrames) {
        this._frameCount += numFrames;
    }
    putSamples(samples, position = 0, numFrames = 0) {
        const sourceOffset = position * 2;
        if (!(numFrames >= 0) || numFrames === 0) {
            numFrames = (samples.length - sourceOffset) / 2;
        }
        const numSamples = numFrames * 2;
        this.ensureCapacity(numFrames + this._frameCount);
        const destOffset = this.endIndex;
        this._vector.set(samples.subarray(sourceOffset, sourceOffset + numSamples), destOffset);
        this._frameCount += numFrames;
    }
    putBuffer(buffer, position = 0, numFrames = 0) {
        if (!(numFrames >= 0) || numFrames === 0) {
            numFrames = buffer.frameCount - position;
        }
        this.putSamples(buffer.vector, buffer.position + position, numFrames);
    }
    receive(numFrames) {
        if (numFrames === undefined || !(numFrames >= 0) || numFrames > this._frameCount) {
            numFrames = this._frameCount;
        }
        this._frameCount -= numFrames;
        this._position += numFrames;
    }
    receiveSamples(output, numFrames = 0) {
        const numSamples = numFrames * 2;
        const sourceOffset = this.startIndex;
        output.set(this._vector.subarray(sourceOffset, sourceOffset + numSamples));
        this.receive(numFrames);
    }
    extract(output, position = 0, numFrames = 0) {
        const sourceOffset = this.startIndex + position * 2;
        const numSamples = numFrames * 2;
        output.set(this._vector.subarray(sourceOffset, sourceOffset + numSamples));
    }
    ensureCapacity(numFrames = 0) {
        const minLength = Math.floor(numFrames * SAMPLES_PER_FRAME);
        if (this._vector.length < minLength) {
            const newByteLength = minLength * BYTES_PER_SAMPLE;
            if (newByteLength <= this._buffer.maxByteLength) {
                this.rewind();
                this._buffer.resize(newByteLength);
                this._vector = new Float32Array(this._buffer);
            } else {
                const newMaxBytes = newByteLength * 2;
                const newBuffer = new ArrayBuffer(newByteLength, {
                    maxByteLength: newMaxBytes
                });
                const newVector = new Float32Array(newBuffer);
                newVector.set(this._vector.subarray(this.startIndex, this.endIndex));
                this._buffer = newBuffer;
                this._vector = newVector;
                this._position = 0;
            }
        } else {
            this.rewind();
        }
    }
    ensureAdditionalCapacity(numFrames = 0) {
        this.ensureCapacity(this._frameCount + numFrames);
    }
    rewind() {
        if (this._position > 0) {
            this._vector.set(this._vector.subarray(this.startIndex, this.endIndex));
            this._position = 0;
        }
    }
}
