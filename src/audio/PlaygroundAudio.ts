import type { LoopClosureKind } from '../game/loop/LoopPath';
import type { EnemyImprintKind } from '../content/enemies';

interface ToneOptions {
  readonly frequency: number;
  readonly endFrequency: number;
  readonly duration: number;
  readonly volume: number;
  readonly delay?: number;
  readonly type?: OscillatorType;
}

interface NoiseOptions {
  readonly duration: number;
  readonly volume: number;
  readonly frequency: number;
  readonly endFrequency: number;
  readonly seed: number;
  readonly delay?: number;
  readonly filterType?: BiquadFilterType;
  readonly q?: number;
}

type WardenAttackCue = 'warden-lash' | 'warden-discharge';
type WardenCaptureCue = 'arm-severed' | 'shell-peeled' | 'core-closed';

export interface PlaygroundAudioMix {
  readonly master: number;
  readonly music: number;
  readonly sfx: number;
}

export interface PlaygroundMusicState {
  readonly intensity: number;
  readonly loopActive: boolean;
  readonly apex: boolean;
  readonly boss: boolean;
}

export const AUDIO_VOLUME_STEPS = Object.freeze([
  0,
  0.25,
  0.5,
  0.75,
  1,
] as const);

export const nextAudioVolumeStep = (current: number): number => {
  const normalized = Number.isFinite(current) ? current : 0;
  const nearestIndex = AUDIO_VOLUME_STEPS.reduce<number>(
    (bestIndex, step, index) =>
      Math.abs(step - normalized) <
      Math.abs(AUDIO_VOLUME_STEPS[bestIndex]! - normalized)
        ? index
        : bestIndex,
    0,
  );
  return AUDIO_VOLUME_STEPS[
    (nearestIndex + 1) % AUDIO_VOLUME_STEPS.length
  ]!;
};

interface MusicNodes {
  readonly drone: OscillatorNode;
  readonly droneGain: GainNode;
  readonly pulse: OscillatorNode;
  readonly pulseGain: GainNode;
  readonly overtone: OscillatorNode;
  readonly overtoneGain: GainNode;
}

const clampUnit = (value: number): number =>
  Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;

export class PlaygroundAudio {
  private context: AudioContext | null = null;
  private masterBus: GainNode | null = null;
  private musicBus: GainNode | null = null;
  private sfxBus: GainNode | null = null;
  private musicNodes: MusicNodes | null = null;
  private mixState: PlaygroundAudioMix = Object.freeze({
    master: 1,
    music: 0.5,
    sfx: 1,
  });

  public get mix(): PlaygroundAudioMix {
    return this.mixState;
  }

  public unlock(): void {
    const context = this.getContext();
    this.ensureMusic(context);
    if (context.state === 'suspended') {
      void context.resume();
    }
  }

  public setMix(mix: PlaygroundAudioMix): void {
    this.mixState = Object.freeze({
      master: clampUnit(mix.master),
      music: clampUnit(mix.music),
      sfx: clampUnit(mix.sfx),
    });
    if (this.context !== null) {
      this.applyMix(this.context);
    }
  }

  public updateMusic(state: PlaygroundMusicState): void {
    const context = this.context;
    const nodes = this.musicNodes;
    if (context === null || nodes === null) {
      return;
    }
    const intensity = clampUnit(state.intensity);
    const now = context.currentTime;
    nodes.drone.frequency.setTargetAtTime(
      state.boss ? 47 : state.apex ? 43 : 38,
      now,
      0.35,
    );
    nodes.droneGain.gain.setTargetAtTime(
      0.018 + intensity * 0.022 + (state.boss ? 0.018 : 0),
      now,
      0.28,
    );
    nodes.pulse.frequency.setTargetAtTime(
      58 + intensity * 38 + (state.loopActive ? 22 : 0),
      now,
      0.18,
    );
    nodes.pulseGain.gain.setTargetAtTime(
      0.002 + intensity * 0.016 + (state.loopActive ? 0.012 : 0),
      now,
      0.16,
    );
    nodes.overtone.frequency.setTargetAtTime(
      state.boss ? 131 : state.apex ? 117 : 96,
      now,
      0.3,
    );
    nodes.overtoneGain.gain.setTargetAtTime(
      state.boss ? 0.012 + intensity * 0.008 : state.apex ? 0.008 : 0.001,
      now,
      0.3,
    );
  }

  public playAnchor(): void {
    this.withRunningContext((context) => {
      this.playTone(context, {
        frequency: 128,
        endFrequency: 62,
        duration: 0.11,
        volume: 0.075,
        type: 'triangle',
      });
      this.playTone(context, {
        frequency: 410,
        endFrequency: 185,
        duration: 0.055,
        volume: 0.028,
        type: 'square',
      });
    });
  }

  public playClosureReady(kind: LoopClosureKind): void {
    const pitchByKind: Record<LoopClosureKind, number> = {
      direct: 510,
      'anchor-snap': 590,
      'trail-snap': 660,
      'self-intersection': 730,
    };

    this.withRunningContext((context) => {
      const pitch = pitchByKind[kind];
      this.playTone(context, {
        frequency: pitch,
        endFrequency: pitch * 1.16,
        duration: 0.065,
        volume: 0.025,
        type: 'sine',
      });
      this.playTone(context, {
        frequency: pitch * 1.22,
        endFrequency: pitch * 1.36,
        duration: 0.055,
        delay: 0.075,
        volume: 0.018,
        type: 'sine',
      });
    });
  }

  public playClosure(
    captured: boolean,
    captureCue: 'ordinary' | 'shell-peeled' = 'ordinary',
  ): void {
    this.withRunningContext((context) => {
      if (!captured) {
        this.playTone(context, {
          frequency: 178,
          endFrequency: 104,
          duration: 0.13,
          volume: 0.035,
          type: 'triangle',
        });
        this.playNoise(context, {
          duration: 0.055,
          volume: 0.012,
          frequency: 420,
          endFrequency: 210,
          seed: 29,
          filterType: 'lowpass',
        });
        return;
      }

      // Closure crack: short and bright enough to register without becoming a gunshot.
      this.playNoise(context, {
        duration: 0.052,
        volume: 0.062,
        frequency: 2_300,
        endFrequency: 760,
        seed: 137,
        filterType: 'highpass',
        q: 0.72,
      });
      this.playTone(context, {
        frequency: 820,
        endFrequency: 156,
        duration: 0.068,
        volume: 0.044,
        type: 'square',
      });

      // Contraction impact: two restrained low layers give the ring physical weight.
      this.playTone(context, {
        frequency: 84,
        endFrequency: 33,
        duration: 0.31,
        delay: 0.012,
        volume: 0.13,
        type: 'sine',
      });
      this.playTone(context, {
        frequency: 126,
        endFrequency: 43,
        duration: 0.24,
        delay: 0.025,
        volume: 0.052,
        type: 'triangle',
      });

      if (captureCue === 'shell-peeled') {
        // Dry bone split plus a short reward pull. The missing tissue-rip tail
        // tells the player that prey survived and needs another closure.
        this.playNoise(context, {
          duration: 0.14,
          delay: 0.06,
          volume: 0.061,
          frequency: 2_900,
          endFrequency: 430,
          seed: 2_683,
          filterType: 'bandpass',
          q: 2.5,
        });
        this.playTone(context, {
          frequency: 246,
          endFrequency: 98,
          duration: 0.18,
          delay: 0.085,
          volume: 0.037,
          type: 'square',
        });
        this.playTone(context, {
          frequency: 390,
          endFrequency: 710,
          duration: 0.13,
          delay: 0.27,
          volume: 0.016,
          type: 'sine',
        });
        return;
      }

      // Tissue separation, followed by an upward filtered pull into the hunter.
      this.playNoise(context, {
        duration: 0.19,
        delay: 0.09,
        volume: 0.046,
        frequency: 670,
        endFrequency: 210,
        seed: 311,
        filterType: 'bandpass',
        q: 1.35,
      });
      this.playNoise(context, {
        duration: 0.28,
        delay: 0.245,
        volume: 0.033,
        frequency: 320,
        endFrequency: 1_450,
        seed: 509,
        filterType: 'bandpass',
        q: 2.1,
      });
      this.playTone(context, {
        frequency: 172,
        endFrequency: 590,
        duration: 0.23,
        delay: 0.29,
        volume: 0.021,
        type: 'sine',
      });
      this.playTone(context, {
        frequency: 760,
        endFrequency: 1_180,
        duration: 0.058,
        delay: 0.5,
        volume: 0.017,
        type: 'triangle',
      });
    });
  }

  public playDamage(lethal: boolean): void {
    this.withRunningContext((context) => {
      this.playNoise(context, {
        duration: lethal ? 0.34 : 0.12,
        volume: lethal ? 0.075 : 0.045,
        frequency: lethal ? 520 : 980,
        endFrequency: 120,
        seed: lethal ? 911 : 719,
        filterType: 'bandpass',
        q: 0.8,
      });
      this.playTone(context, {
        frequency: lethal ? 92 : 174,
        endFrequency: lethal ? 26 : 74,
        duration: lethal ? 0.58 : 0.19,
        volume: lethal ? 0.11 : 0.055,
        type: 'sawtooth',
      });
    });
  }

  public playEvolution(): void {
    this.withRunningContext((context) => {
      for (let index = 0; index < 3; index += 1) {
        this.playTone(context, {
          frequency: 148 * 1.34 ** index,
          endFrequency: 218 * 1.34 ** index,
          duration: 0.18,
          delay: index * 0.07,
          volume: 0.025 - index * 0.003,
          type: index === 0 ? 'triangle' : 'sine',
        });
      }
    });
  }

  public playLoopCut(): void {
    this.withRunningContext((context) => {
      this.playNoise(context, {
        duration: 0.16,
        volume: 0.052,
        frequency: 2_100,
        endFrequency: 280,
        seed: 823,
        filterType: 'bandpass',
        q: 1.8,
      });
      this.playTone(context, {
        frequency: 420,
        endFrequency: 82,
        duration: 0.2,
        volume: 0.045,
        type: 'sawtooth',
      });
    });
  }

  public playImprint(kind: EnemyImprintKind | null): void {
    this.withRunningContext((context) => {
      const profile: Record<EnemyImprintKind, readonly [number, number]> = {
        blade: [690, 142],
        nerve: [510, 720],
        spike: [310, 118],
        symmetry: [430, 860],
      };
      const [start, end] = profile[kind ?? 'nerve'];
      this.playTone(context, {
        frequency: start,
        endFrequency: end,
        duration: 0.22,
        volume: 0.035,
        type: kind === 'spike' || kind === 'blade' ? 'square' : 'sine',
      });
      this.playNoise(context, {
        duration: 0.12,
        volume: 0.018,
        frequency: kind === 'spike' ? 760 : 1_300,
        endFrequency: kind === 'blade' ? 190 : 420,
        seed: kind === 'symmetry' ? 709 : kind === 'blade' ? 503 : 401,
        filterType: 'bandpass',
        q: 1.4,
      });
    });
  }

  public playWardenArrival(): void {
    this.withRunningContext((context) => {
      this.playTone(context, {
        frequency: 54,
        endFrequency: 27,
        duration: 1.05,
        volume: 0.12,
        type: 'sine',
      });
      this.playNoise(context, {
        duration: 0.82,
        delay: 0.14,
        volume: 0.032,
        frequency: 180,
        endFrequency: 690,
        seed: 1_409,
        filterType: 'bandpass',
        q: 1.6,
      });
    });
  }

  public playWardenAttack(kind: WardenAttackCue): void {
    this.withRunningContext((context) => {
      if (kind === 'warden-lash') {
        this.playNoise(context, {
          duration: 0.13,
          volume: 0.054,
          frequency: 2_700,
          endFrequency: 310,
          seed: 1_621,
          filterType: 'bandpass',
          q: 1.25,
        });
        this.playTone(context, {
          frequency: 230,
          endFrequency: 58,
          duration: 0.18,
          volume: 0.047,
          type: 'sawtooth',
        });
        return;
      }

      this.playTone(context, {
        frequency: 76,
        endFrequency: 42,
        duration: 0.34,
        volume: 0.085,
        type: 'sine',
      });
      this.playNoise(context, {
        duration: 0.23,
        volume: 0.04,
        frequency: 430,
        endFrequency: 1_800,
        seed: 1_907,
        filterType: 'bandpass',
        q: 1.9,
      });
    });
  }

  public playWardenCapture(kind: WardenCaptureCue): void {
    this.withRunningContext((context) => {
      const isCore = kind === 'core-closed';
      const isShell = kind === 'shell-peeled';
      this.playTone(context, {
        frequency: isCore ? 184 : isShell ? 132 : 210,
        endFrequency: isCore ? 42 : 54,
        duration: isCore ? 0.74 : 0.31,
        delay: 0.04,
        volume: isCore ? 0.12 : 0.062,
        type: isCore ? 'sawtooth' : 'triangle',
      });
      this.playNoise(context, {
        duration: isCore ? 0.48 : 0.19,
        delay: 0.08,
        volume: isCore ? 0.058 : 0.036,
        frequency: isShell ? 1_280 : 2_100,
        endFrequency: isCore ? 120 : 260,
        seed: isCore ? 2_377 : isShell ? 2_143 : 2_021,
        filterType: 'bandpass',
        q: isShell ? 2.2 : 1.35,
      });
    });
  }

  private getContext(): AudioContext {
    if (this.context === null) {
      this.context = new AudioContext();
      this.ensureBuses(this.context);
    }
    return this.context;
  }

  private withRunningContext(action: (context: AudioContext) => void): void {
    const context = this.getContext();

    if (context.state === 'running') {
      action(context);
      return;
    }

    void context.resume().then(() => action(context));
  }

  private playTone(context: AudioContext, options: ToneOptions): void {
    const startTime = context.currentTime + (options.delay ?? 0);
    const endTime = startTime + options.duration;
    const oscillator = context.createOscillator();
    const gain = context.createGain();

    oscillator.type = options.type ?? 'sine';
    oscillator.frequency.setValueAtTime(options.frequency, startTime);
    oscillator.frequency.exponentialRampToValueAtTime(
      Math.max(1, options.endFrequency),
      endTime,
    );

    gain.gain.setValueAtTime(0.0001, startTime);
    gain.gain.exponentialRampToValueAtTime(
      Math.max(0.0001, options.volume),
      startTime + Math.min(0.015, options.duration * 0.25),
    );
    gain.gain.exponentialRampToValueAtTime(0.0001, endTime);

    oscillator.connect(gain);
    gain.connect(this.ensureBuses(context).sfx);
    oscillator.start(startTime);
    oscillator.stop(endTime + 0.01);
  }

  private playNoise(context: AudioContext, options: NoiseOptions): void {
    const startTime = context.currentTime + (options.delay ?? 0);
    const endTime = startTime + options.duration;
    const frameCount = Math.max(
      1,
      Math.ceil(context.sampleRate * options.duration),
    );
    const buffer = context.createBuffer(1, frameCount, context.sampleRate);
    const channel = buffer.getChannelData(0);
    let state = options.seed >>> 0;

    for (let index = 0; index < channel.length; index += 1) {
      state = (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0;
      channel[index] = (state / 0xffff_ffff) * 2 - 1;
    }

    const source = context.createBufferSource();
    const filter = context.createBiquadFilter();
    const gain = context.createGain();

    source.buffer = buffer;
    filter.type = options.filterType ?? 'bandpass';
    filter.Q.setValueAtTime(options.q ?? 1, startTime);
    filter.frequency.setValueAtTime(options.frequency, startTime);
    filter.frequency.exponentialRampToValueAtTime(
      Math.max(20, options.endFrequency),
      endTime,
    );

    gain.gain.setValueAtTime(0.0001, startTime);
    gain.gain.exponentialRampToValueAtTime(
      Math.max(0.0001, options.volume),
      startTime + Math.min(0.009, options.duration * 0.18),
    );
    gain.gain.exponentialRampToValueAtTime(0.0001, endTime);

    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.ensureBuses(context).sfx);
    source.start(startTime);
    source.stop(endTime + 0.01);
  }

  private ensureBuses(context: AudioContext): {
    readonly music: GainNode;
    readonly sfx: GainNode;
  } {
    if (
      this.masterBus !== null &&
      this.musicBus !== null &&
      this.sfxBus !== null
    ) {
      return { music: this.musicBus, sfx: this.sfxBus };
    }

    this.masterBus = context.createGain();
    this.musicBus = context.createGain();
    this.sfxBus = context.createGain();
    this.musicBus.connect(this.masterBus);
    this.sfxBus.connect(this.masterBus);
    this.masterBus.connect(context.destination);
    this.applyMix(context);
    return { music: this.musicBus, sfx: this.sfxBus };
  }

  private applyMix(context: AudioContext): void {
    if (
      this.masterBus === null ||
      this.musicBus === null ||
      this.sfxBus === null
    ) {
      return;
    }
    const now = context.currentTime;
    this.masterBus.gain.setTargetAtTime(this.mixState.master, now, 0.025);
    this.musicBus.gain.setTargetAtTime(this.mixState.music, now, 0.025);
    this.sfxBus.gain.setTargetAtTime(this.mixState.sfx, now, 0.025);
  }

  private ensureMusic(context: AudioContext): void {
    if (this.musicNodes !== null) {
      return;
    }
    const { music } = this.ensureBuses(context);
    const drone = context.createOscillator();
    const droneGain = context.createGain();
    const pulse = context.createOscillator();
    const pulseGain = context.createGain();
    const overtone = context.createOscillator();
    const overtoneGain = context.createGain();

    drone.type = 'sine';
    drone.frequency.value = 38;
    droneGain.gain.value = 0.018;
    pulse.type = 'triangle';
    pulse.frequency.value = 58;
    pulseGain.gain.value = 0.002;
    overtone.type = 'sine';
    overtone.frequency.value = 96;
    overtoneGain.gain.value = 0.001;

    drone.connect(droneGain);
    pulse.connect(pulseGain);
    overtone.connect(overtoneGain);
    droneGain.connect(music);
    pulseGain.connect(music);
    overtoneGain.connect(music);
    drone.start();
    pulse.start();
    overtone.start();
    this.musicNodes = {
      drone,
      droneGain,
      pulse,
      pulseGain,
      overtone,
      overtoneGain,
    };
  }
}
