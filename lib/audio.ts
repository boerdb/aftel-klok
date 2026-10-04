const VOLUME_KEY = 'aftelklok-volume';
const DEFAULT_VOLUME = 0.45;

let audioContext: AudioContext | null = null;
let beepVolume = DEFAULT_VOLUME;

function clampVolume(value: number): number {
  if (!Number.isFinite(value)) {
    return DEFAULT_VOLUME;
  }

  return Math.min(1, Math.max(0, value));
}

export function getBeepVolume(): number {
  return beepVolume;
}

export function loadBeepVolume(): number {
  if (typeof window === 'undefined') {
    return beepVolume;
  }

  const stored = window.localStorage.getItem(VOLUME_KEY);
  if (stored !== null) {
    beepVolume = clampVolume(Number(stored));
  }

  return beepVolume;
}

export function setBeepVolume(volume: number): void {
  beepVolume = clampVolume(volume);

  if (typeof window !== 'undefined') {
    window.localStorage.setItem(VOLUME_KEY, String(beepVolume));
  }
}

function initContext(): AudioContext | null {
  if (typeof window === 'undefined') {
    return null;
  }

  if (!audioContext) {
    const AudioContextCtor =
      window.AudioContext ||
      (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;

    if (!AudioContextCtor) {
      return null;
    }

    audioContext = new AudioContextCtor();
  }

  if (audioContext.state === 'suspended') {
    void audioContext.resume();
  }

  return audioContext;
}

function playTone(frequency: number, duration: number, volume = 0.1): void {
  const context = initContext();
  if (!context || volume < 0.001) {
    return;
  }

  const oscillator = context.createOscillator();
  const gainNode = context.createGain();

  oscillator.connect(gainNode);
  gainNode.connect(context.destination);

  oscillator.type = 'sine';
  oscillator.frequency.setValueAtTime(frequency, context.currentTime);

  gainNode.gain.setValueAtTime(0.0001, context.currentTime);
  gainNode.gain.exponentialRampToValueAtTime(volume, context.currentTime + 0.005);
  gainNode.gain.setValueAtTime(volume, context.currentTime + Math.max(duration - 0.02, 0.01));
  gainNode.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + duration);

  oscillator.start();
  oscillator.stop(context.currentTime + duration);
}

export function unlockAudio(): void {
  initContext();
}

export function playShortBeep(): void {
  playTone(1000, 0.1, 0.75 * beepVolume);
}

export function playLongBeep(): void {
  playTone(1000, 0.5, beepVolume);
}
