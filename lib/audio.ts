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

// iPadOS freezes JavaScript and Web Audio in the background, but keeps a playing <audio> element going.
// The whole session is therefore rendered up front as one track of silence and beeps.
const TRACK_SAMPLE_RATE = 8000;
const MAX_TRACK_SECONDS = 90 * 60;

let track: HTMLAudioElement | null = null;
let trackUrl: string | null = null;
let trackLength = 0;

function renderTrack(beeps: { at: number; beep: 'short' | 'long' }[], lengthSeconds: number): Blob {
  const samples = Math.ceil(lengthSeconds * TRACK_SAMPLE_RATE);
  const bytes = new Uint8Array(44 + samples);
  const view = new DataView(bytes.buffer);
  const writeText = (offset: number, text: string) =>
    [...text].forEach((character, index) => view.setUint8(offset + index, character.charCodeAt(0)));

  writeText(0, 'RIFF');
  view.setUint32(4, 36 + samples, true);
  writeText(8, 'WAVE');
  writeText(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, TRACK_SAMPLE_RATE, true);
  view.setUint32(28, TRACK_SAMPLE_RATE, true);
  view.setUint16(32, 1, true);
  view.setUint16(34, 8, true);
  writeText(36, 'data');
  view.setUint32(40, samples, true);

  const pcm = bytes.subarray(44);
  pcm.fill(128);

  for (const { at, beep } of beeps) {
    const duration = beep === 'long' ? 0.5 : 0.1;
    const volume = beep === 'long' ? beepVolume : 0.75 * beepVolume;
    const first = Math.round(at * TRACK_SAMPLE_RATE);
    const count = Math.min(Math.round(duration * TRACK_SAMPLE_RATE), samples - first);
    const fade = Math.round(0.01 * TRACK_SAMPLE_RATE);

    for (let index = 0; index < count; index += 1) {
      const envelope = Math.min(1, index / fade, (count - index) / fade);
      const value = Math.sin((2 * Math.PI * 1000 * index) / TRACK_SAMPLE_RATE) * volume * envelope;
      pcm[first + index] = Math.round(128 + 127 * value);
    }
  }

  return new Blob([bytes], { type: 'audio/wav' });
}

// Must be called from a user gesture, otherwise iPadOS refuses to play.
export function startSessionTrack(beeps: { at: number; beep: 'short' | 'long' }[], lengthSeconds: number): void {
  if (typeof window === 'undefined') {
    return;
  }

  stopSessionTrack();
  trackLength = Math.min(lengthSeconds, MAX_TRACK_SECONDS);
  trackUrl = URL.createObjectURL(
    renderTrack(
      beeps.filter((entry) => entry.at < trackLength),
      trackLength,
    ),
  );
  track = new Audio(trackUrl);
  track.preload = 'auto';
  track.setAttribute('playsinline', '');

  if ('mediaSession' in navigator) {
    navigator.mediaSession.metadata = new MediaMetadata({ title: 'Aftelklok', artist: 'Fysiotherapie en Training' });
  }

  void track.play().catch(() => stopSessionTrack());
}

export function pauseSessionTrack(): void {
  track?.pause();
}

export function resumeSessionTrack(elapsedSeconds: number): void {
  if (!track || elapsedSeconds >= trackLength) {
    return;
  }

  syncSessionTrack(elapsedSeconds);
  void track.play().catch(() => undefined);
}

// Pulls the track back onto the wall clock, e.g. after the app returns from the background.
export function syncSessionTrack(elapsedSeconds: number): void {
  if (!track) {
    return;
  }

  if (Math.abs(track.currentTime - elapsedSeconds) > 0.25) {
    track.currentTime = elapsedSeconds;
  }
}

export function stopSessionTrack(): void {
  if (track) {
    track.pause();
    track.removeAttribute('src');
    track.load();
    track = null;
  }

  if (trackUrl) {
    URL.revokeObjectURL(trackUrl);
    trackUrl = null;
  }

  trackLength = 0;
}

// True while the track is playing and still covers this moment, so the beep is already in it.
export function sessionTrackCovers(elapsedSeconds: number): boolean {
  return track !== null && !track.paused && elapsedSeconds < trackLength;
}
