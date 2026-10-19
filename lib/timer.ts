export const RING_RADIUS = 46;
export const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;
export const MAX_DURATION_SECONDS = 9 * 60 + 59;
export const OPENING_REST_SECONDS = 5;

export interface ClockState {
  workMinutes: number;
  workSeconds: number;
  pauseMinutes: number;
  pauseSeconds: number;
  totalRounds: number;
  timeLeft: number;
  remainingRounds: number;
  isWorkPhase: boolean;
  isRunning: boolean;
  isPaused: boolean;
}

export type Beep = 'short' | 'long' | null;

export const initialState: ClockState = {
  workMinutes: 0,
  workSeconds: 30,
  pauseMinutes: 0,
  pauseSeconds: 15,
  totalRounds: 5,
  timeLeft: 15,
  remainingRounds: 5,
  isWorkPhase: false,
  isRunning: false,
  isPaused: false,
};

export function parseWholeNumber(value: number | string | null | undefined): number {
  const parsedValue = Number.parseInt(`${value ?? 0}`, 10);
  return Number.isNaN(parsedValue) ? 0 : Math.max(0, parsedValue);
}

export function toDurationInSeconds(minutes: number, seconds: number): number {
  return Math.max(0, minutes) * 60 + Math.max(0, seconds);
}

export function splitDuration(totalSeconds: number): { minutes: number; seconds: number } {
  const normalizedSeconds = Math.max(0, totalSeconds);
  return {
    minutes: Math.floor(normalizedSeconds / 60),
    seconds: normalizedSeconds % 60,
  };
}

export function workDuration(state: ClockState): number {
  return Math.max(1, toDurationInSeconds(state.workMinutes, state.workSeconds));
}

export function pauseDuration(state: ClockState): number {
  return Math.max(1, toDurationInSeconds(state.pauseMinutes, state.pauseSeconds));
}

export function showsMinutes(totalSeconds: number): boolean {
  return Math.max(0, totalSeconds) >= 60;
}

export function formatDuration(totalSeconds: number): string {
  const normalizedSeconds = Math.max(0, totalSeconds);

  if (normalizedSeconds < 60) {
    return normalizedSeconds.toString();
  }

  const minutes = Math.floor(normalizedSeconds / 60);
  const seconds = normalizedSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

function isOpeningRest(state: ClockState): boolean {
  return state.isRunning && !state.isWorkPhase && state.remainingRounds === state.totalRounds;
}

function currentPhaseDuration(state: ClockState): number {
  if (state.isWorkPhase) {
    return workDuration(state);
  }

  if (isOpeningRest(state)) {
    return OPENING_REST_SECONDS;
  }

  return pauseDuration(state);
}

export function ringOffset(state: ClockState): number {
  const total = Math.max(1, currentPhaseDuration(state));
  const elapsed = Math.min(total, Math.max(0, total - state.timeLeft));
  const elapsedRatio = elapsed / total;
  const progress = state.isWorkPhase ? elapsedRatio : 1 - elapsedRatio;
  return RING_CIRCUMFERENCE * (1 - progress);
}

function withIdlePreview(state: ClockState): ClockState {
  if (state.isRunning) {
    return state;
  }

  return {
    ...state,
    timeLeft: pauseDuration(state),
    remainingRounds: Math.max(0, state.totalRounds),
    isWorkPhase: false,
    isPaused: false,
  };
}

export function updateDurationPart(
  state: ClockState,
  phase: 'work' | 'pause',
  part: 'minutes' | 'seconds',
  value: number | string | null | undefined,
): ClockState {
  const parsedValue = parseWholeNumber(value);
  const currentMinutes = phase === 'work' ? state.workMinutes : state.pauseMinutes;
  const currentSeconds = phase === 'work' ? state.workSeconds : state.pauseSeconds;
  const minutes = Math.min(9, part === 'minutes' ? parsedValue : currentMinutes);
  const seconds = part === 'seconds' ? parsedValue : currentSeconds;
  const totalSeconds = Math.min(MAX_DURATION_SECONDS, toDurationInSeconds(minutes, seconds));
  const parts = splitDuration(totalSeconds);

  if (phase === 'work') {
    return withIdlePreview({
      ...state,
      workMinutes: parts.minutes,
      workSeconds: parts.seconds,
    });
  }

  return withIdlePreview({
    ...state,
    pauseMinutes: parts.minutes,
    pauseSeconds: parts.seconds,
  });
}

export function updateRounds(
  state: ClockState,
  value: number | string | null | undefined,
): ClockState {
  return withIdlePreview({
    ...state,
    totalRounds: parseWholeNumber(value),
  });
}

export function prepareTimer(state: ClockState): ClockState {
  const rounds = Math.max(1, state.totalRounds);

  return {
    ...state,
    totalRounds: rounds,
    timeLeft: pauseDuration(state),
    remainingRounds: rounds,
    isWorkPhase: false,
    isRunning: false,
    isPaused: false,
  };
}

export function startTimer(state: ClockState): ClockState {
  return {
    ...prepareTimer(state),
    timeLeft: OPENING_REST_SECONDS,
    isRunning: true,
  };
}

export function togglePause(state: ClockState): ClockState {
  if (!state.isRunning) {
    return state;
  }

  return {
    ...state,
    isPaused: !state.isPaused,
  };
}

export function stopTimer(state: ClockState): ClockState {
  return prepareTimer(state);
}

export function reduceTick(state: ClockState): { state: ClockState; beep: Beep } {
  if (!state.isRunning || state.isPaused) {
    return { state, beep: null };
  }

  if (state.timeLeft > 0) {
    const timeLeft = state.timeLeft - 1;
    const beep: Beep = timeLeft === 0 ? 'long' : timeLeft <= 3 ? 'short' : null;
    return { state: { ...state, timeLeft }, beep };
  }

  if (state.isWorkPhase) {
    if (state.remainingRounds > 1) {
      return {
        state: {
          ...state,
          remainingRounds: state.remainingRounds - 1,
          isWorkPhase: false,
          timeLeft: pauseDuration(state),
        },
        beep: null,
      };
    }

    return { state: prepareTimer(state), beep: null };
  }

  return {
    state: {
      ...state,
      isWorkPhase: true,
      timeLeft: workDuration(state),
    },
    beep: null,
  };
}

export function advanceTimer(state: ClockState, elapsedSeconds: number): { state: ClockState; beep: Beep } {
  const steps = Math.floor(elapsedSeconds);
  if (steps <= 0 || !state.isRunning || state.isPaused) {
    return { state, beep: null };
  }

  if (steps === 1) {
    return reduceTick(state);
  }

  let next = state;
  let remaining = steps;

  while (remaining > 0 && next.isRunning) {
    if (next.timeLeft > 0) {
      const consume = Math.min(remaining, next.timeLeft);
      next = { ...next, timeLeft: next.timeLeft - consume };
      remaining -= consume;
      continue;
    }

    next = reduceTick(next).state;
    remaining -= 1;
  }

  return { state: next, beep: null };
}
