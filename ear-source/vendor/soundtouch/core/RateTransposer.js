import AbstractSamplePipe from './AbstractSamplePipe.js';
import CircularSampleBuffer from './CircularSampleBuffer.js';
import { createCircularSampleBufferAdapter } from './SampleBufferAdapter.js';
import { resolveInterpolationStrategyRuntime } from './interpolationStrategyRegistry.js';
export default class RateTransposer extends AbstractSamplePipe {
    _rate;
    fractionalPosition;
    previousLeftSample;
    previousRightSample;
    inputScratch;
    outputScratch;
    sampleBufferAdapterFactory;
    sampleBufferFactory;
    inputAdapter;
    interpolationStrategy;
    resolvedInterpolationKernel;
    kernelState;
    interpolationStrategyParams;
    applyKernelParams;
    constructor({ createBuffers = false, sampleBufferAdapterFactory = createCircularSampleBufferAdapter, sampleBufferFactory = ()=>new CircularSampleBuffer(), interpolationStrategy } = {}){
        super({
            createBuffers,
            inputBufferFactory: sampleBufferFactory,
            outputBufferFactory: sampleBufferFactory
        });
        this.fractionalPosition = -1;
        this.previousLeftSample = 0;
        this.previousRightSample = 0;
        this._rate = 1;
        this.inputScratch = new Float32Array(0);
        this.outputScratch = new Float32Array(0);
        this.sampleBufferAdapterFactory = sampleBufferAdapterFactory;
        this.sampleBufferFactory = sampleBufferFactory;
        this.inputAdapter = sampleBufferAdapterFactory();
        this.interpolationStrategy = 'lanczos';
        this.resolvedInterpolationKernel = ()=>0;
        this.kernelState = undefined;
        this.interpolationStrategyParams = {};
        this.applyKernelParams = undefined;
        this.setInterpolationStrategy(interpolationStrategy ?? 'lanczos');
    }
    set rate(rate) {
        this._rate = rate;
    }
    get strategy() {
        return this.interpolationStrategy;
    }
    get strategyParams() {
        return {
            ...this.interpolationStrategyParams
        };
    }
    setInterpolationStrategy(strategy) {
        const resolved = resolveInterpolationStrategyRuntime(strategy);
        this.interpolationStrategy = resolved.id;
        this.resolvedInterpolationKernel = resolved.kernel;
        this.interpolationStrategyParams = {
            ...resolved.params
        };
        this.applyKernelParams = resolved.applyParams;
        if ('createState' in this.resolvedInterpolationKernel && typeof this.resolvedInterpolationKernel.createState === 'function') {
            this.kernelState = this.resolvedInterpolationKernel.createState();
        } else {
            this.kernelState = undefined;
        }
        if (this.applyKernelParams !== undefined) {
            this.applyKernelParams(this.kernelState, this.interpolationStrategyParams);
        }
        this.reset();
    }
    setInterpolationStrategyParams(params) {
        const nextParams = {
            ...this.interpolationStrategyParams
        };
        for (const [key, value] of Object.entries(params)){
            if (value !== undefined) {
                nextParams[key] = value;
            }
        }
        this.interpolationStrategyParams = nextParams;
        if (this.applyKernelParams !== undefined) {
            this.applyKernelParams(this.kernelState, this.interpolationStrategyParams);
        }
    }
    reset() {
        this.fractionalPosition = -1;
        this.previousLeftSample = 0;
        this.previousRightSample = 0;
    }
    clear() {
        super.clear();
        this.inputAdapter.clear();
        this.reset();
    }
    clone() {
        const result = new RateTransposer({
            createBuffers: false,
            sampleBufferAdapterFactory: this.sampleBufferAdapterFactory,
            sampleBufferFactory: this.sampleBufferFactory,
            interpolationStrategy: {
                id: this.interpolationStrategy,
                params: this.interpolationStrategyParams
            }
        });
        result.rate = this._rate;
        return result;
    }
    process() {
        if (this._inputBuffer === null || this._outputBuffer === null) {
            return;
        }
        this.inputAdapter.syncFromInputBuffer(this._inputBuffer);
        const numFrames = this.inputAdapter.frameCount;
        if (numFrames === 0) {
            return;
        }
        const numFramesOutput = this.transpose(numFrames);
        this.inputAdapter.receive(numFrames);
        if (numFramesOutput > 0) {
            this._outputBuffer.putSamples(this.outputScratch, 0, numFramesOutput);
        }
    }
    ensureScratchCapacity(numInputFrames) {
        const inputSamples = numInputFrames * 2;
        if (this.inputScratch.length < inputSamples) {
            this.inputScratch = new Float32Array(inputSamples);
        }
        const estimatedOutputFrames = Math.ceil(numInputFrames / this._rate) + 2;
        const outputSamples = Math.max(0, estimatedOutputFrames) * 2;
        if (this.outputScratch.length < outputSamples) {
            this.outputScratch = new Float32Array(outputSamples);
        }
    }
    transpose(numFrames = 0) {
        if (this._inputBuffer !== null) {
            this.inputAdapter.syncFromInputBuffer(this._inputBuffer);
            if (numFrames === 0) {
                numFrames = this.inputAdapter.frameCount;
            }
        }
        if (numFrames === 0) {
            return 0;
        }
        this.ensureScratchCapacity(numFrames);
        const src = this.inputScratch;
        const extractedFrames = this.inputAdapter.extract(src, 0, numFrames);
        if (extractedFrames === 0) {
            return 0;
        }
        numFrames = extractedFrames;
        return this.transposePluginKernel(numFrames);
    }
    transposePluginKernel(numFrames) {
        const src = this.inputScratch;
        const dest = this.outputScratch;
        const srcOffset = 0;
        const destOffset = 0;
        const kernel = this.resolvedInterpolationKernel;
        const state = this.kernelState;
        const stateRecord = this.getKernelStateRecord(state);
        if (stateRecord !== undefined) {
            stateRecord.prevSampleL = this.previousLeftSample;
            stateRecord.prevSampleR = this.previousRightSample;
        }
        let i = 0;
        let position = this.fractionalPosition;
        const maxPosition = numFrames - 1;
        while(position <= maxPosition){
            dest[destOffset + 2 * i] = kernel(src, srcOffset, numFrames, position, 0, state);
            dest[destOffset + 2 * i + 1] = kernel(src, srcOffset, numFrames, position, 1, state);
            i = i + 1;
            position += this._rate;
        }
        this.fractionalPosition = position - numFrames;
        this.previousLeftSample = src[srcOffset + 2 * numFrames - 2];
        this.previousRightSample = src[srcOffset + 2 * numFrames - 1];
        if (stateRecord !== undefined) {
            stateRecord.prevSampleL = this.previousLeftSample;
            stateRecord.prevSampleR = this.previousRightSample;
        }
        return i;
    }
    getKernelStateRecord(state) {
        if (typeof state !== 'object' || state === null) {
            return undefined;
        }
        const record = state;
        const prevSampleL = record['prevSampleL'];
        const prevSampleR = record['prevSampleR'];
        if (typeof prevSampleL === 'number' && typeof prevSampleR === 'number') {
            return record;
        }
        return undefined;
    }
}
