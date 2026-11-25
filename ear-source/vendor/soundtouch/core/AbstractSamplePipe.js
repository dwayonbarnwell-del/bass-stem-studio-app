export default class AbstractSamplePipe {
    _inputBuffer;
    _outputBuffer;
    constructor({ createBuffers = false, inputBufferFactory, outputBufferFactory } = {}){
        if (createBuffers) {
            if (!inputBufferFactory || !outputBufferFactory) {
                throw new Error('buffer factories are required when createBuffers is true');
            }
            this._inputBuffer = inputBufferFactory();
            this._outputBuffer = outputBufferFactory();
        } else {
            this._inputBuffer = null;
            this._outputBuffer = null;
        }
    }
    get inputBuffer() {
        return this._inputBuffer;
    }
    set inputBuffer(inputBuffer) {
        this._inputBuffer = inputBuffer;
    }
    get outputBuffer() {
        return this._outputBuffer;
    }
    set outputBuffer(outputBuffer) {
        this._outputBuffer = outputBuffer;
    }
    clear() {
        this._inputBuffer?.clear();
        this._outputBuffer?.clear();
    }
}
