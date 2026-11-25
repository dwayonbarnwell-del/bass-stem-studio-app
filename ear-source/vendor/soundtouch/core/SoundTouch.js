import RateTransposer from './RateTransposer.js';
import { createCircularStretchInputBufferAdapter, createFifoStretchInputBufferAdapter, default as Stretch } from './Stretch.js';
import CircularSampleBuffer from './CircularSampleBuffer.js';
import FifoSampleBuffer from './FifoSampleBuffer.js';
import { createCircularSampleBufferAdapter, createFifoSampleBufferAdapter } from './SampleBufferAdapter.js';
import isFloatDifferent from './testFloatEqual.js';
export default class SoundTouch {
    transposer;
    stretch;
    _sampleRate;
    _sampleBufferType;
    _sampleBufferFactory;
    _interpolationStrategy;
    _inputBuffer;
    _intermediateBuffer;
    _outputBuffer;
    _rate;
    _tempo;
    virtualPitch;
    constructor(options = {}){
        this._sampleBufferType = options.sampleBufferType ?? 'circular';
        this._sampleBufferFactory = options.sampleBufferFactory ?? (this._sampleBufferType === 'fifo' ? ()=>new FifoSampleBuffer() : ()=>new CircularSampleBuffer());
        this.transposer = new RateTransposer({
            createBuffers: false,
            sampleBufferAdapterFactory: this._sampleBufferType === 'circular' ? createCircularSampleBufferAdapter : createFifoSampleBufferAdapter,
            sampleBufferFactory: this._sampleBufferFactory,
            interpolationStrategy: options.interpolationStrategy
        });
        this._interpolationStrategy = this.transposer.strategy;
        this._sampleRate = options.sampleRate ?? 44100;
        if (options.stretchFactory) {
            this.stretch = options.stretchFactory(this._sampleRate, {
                sampleBufferFactory: this._sampleBufferFactory,
                sampleBufferType: this._sampleBufferType
            });
        } else {
            this.stretch = new Stretch({
                sampleRate: this._sampleRate,
                createBuffers: false,
                inputBufferAdapterFactory: this._sampleBufferType === 'circular' ? createCircularStretchInputBufferAdapter : createFifoStretchInputBufferAdapter,
                sampleBufferFactory: this._sampleBufferFactory
            });
        }
        this.stretch.setParameters(this._sampleRate, 0, 0, 0);
        this._inputBuffer = this._sampleBufferFactory();
        this._intermediateBuffer = this._sampleBufferFactory();
        this._outputBuffer = this._sampleBufferFactory();
        this._rate = 0;
        this._tempo = 0;
        this.virtualPitch = 1.0;
        this.calculateEffectiveRateAndTempo();
    }
    clear() {
        this.transposer.clear();
        this.stretch.clear();
    }
    clone() {
        const result = new SoundTouch({
            sampleRate: this._sampleRate,
            sampleBufferType: this._sampleBufferType,
            sampleBufferFactory: this._sampleBufferFactory,
            interpolationStrategy: {
                id: this._interpolationStrategy,
                params: this.transposer.strategyParams
            }
        });
        result.pitch = this.virtualPitch;
        return result;
    }
    get interpolationStrategy() {
        return this._interpolationStrategy;
    }
    get interpolationStrategyParams() {
        return this.transposer.strategyParams;
    }
    setInterpolationStrategy(strategy) {
        this.transposer.setInterpolationStrategy(strategy);
        this._interpolationStrategy = this.transposer.strategy;
    }
    setInterpolationStrategyParams(params) {
        this.transposer.setInterpolationStrategyParams(params);
    }
    setStretchParameters(params) {
        this.stretch.setStretchParameters(params);
    }
    set pitch(pitch) {
        this.virtualPitch = pitch;
        this.calculateEffectiveRateAndTempo();
    }
    set pitchOctaves(pitchOctaves) {
        this.pitch = Math.exp(0.69314718056 * pitchOctaves);
        this.calculateEffectiveRateAndTempo();
    }
    set pitchSemitones(pitchSemitones) {
        this.pitchOctaves = pitchSemitones / 12.0;
    }
    get inputBuffer() {
        return this._inputBuffer;
    }
    get outputBuffer() {
        return this._outputBuffer;
    }
    calculateEffectiveRateAndTempo() {
        const previousTempo = this._tempo;
        const previousRate = this._rate;
        this._tempo = 1.0 / this.virtualPitch;
        this._rate = this.virtualPitch;
        if (isFloatDifferent(this._tempo, previousTempo)) {
            this.stretch.tempo = this._tempo;
        }
        if (isFloatDifferent(this._rate, previousRate)) {
            this.transposer.rate = this._rate;
        }
        if (this._rate > 1.0) {
            if (this._outputBuffer !== this.transposer.outputBuffer) {
                this.stretch.inputBuffer = this._inputBuffer;
                this.stretch.outputBuffer = this._intermediateBuffer;
                this.transposer.inputBuffer = this._intermediateBuffer;
                this.transposer.outputBuffer = this._outputBuffer;
            }
        } else {
            if (this._outputBuffer !== this.stretch.outputBuffer) {
                this.transposer.inputBuffer = this._inputBuffer;
                this.transposer.outputBuffer = this._intermediateBuffer;
                this.stretch.inputBuffer = this._intermediateBuffer;
                this.stretch.outputBuffer = this._outputBuffer;
            }
        }
    }
    process() {
        if (this._rate > 1.0) {
            this.stretch.process();
            this.transposer.process();
        } else {
            this.transposer.process();
            this.stretch.process();
        }
    }
}
