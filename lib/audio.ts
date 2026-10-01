let audioContext: AudioContext | null = null;

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
  if (!context) {
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
  playTone(1000, 0.1, 0.34);
}

export function playLongBeep(): void {
  playTone(1000, 0.5, 0.45);
}
