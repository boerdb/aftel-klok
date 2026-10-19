import { describe, expect, it } from 'vitest';
import {
  advanceTimer,
  formatDuration,
  initialState,
  OPENING_REST_SECONDS,
  prepareTimer,
  reduceTick,
  ringOffset,
  showsMinutes,
  startTimer,
  stopTimer,
  updateDurationPart,
  updateRounds,
} from './timer';

describe('timer', () => {
  it('normalizes seconds input into minutes and seconds', () => {
    const next = updateDurationPart(initialState, 'work', 'seconds', 75);

    expect(next.workMinutes).toBe(1);
    expect(next.workSeconds).toBe(15);
    expect(next.workMinutes * 60 + next.workSeconds).toBe(75);
  });

  it('formats the countdown as m:ss above one minute', () => {
    expect(formatDuration(125)).toBe('2:05');
  });

  it('caps a duration at 9:59', () => {
    const next = updateDurationPart(initialState, 'work', 'minutes', 12);

    expect(next.workMinutes).toBe(9);
    expect(next.workSeconds).toBe(30);
    expect(formatDuration(next.workMinutes * 60 + next.workSeconds)).toBe('9:30');
  });

  it('formats the countdown as seconds only below one minute', () => {
    expect(formatDuration(59)).toBe('59');
  });

  it('switches to minute display from 60 seconds onwards', () => {
    expect(showsMinutes(60)).toBe(true);
    expect(formatDuration(60)).toBe('1:00');
  });

  it('starts with a rest phase when the timer is prepared', () => {
    const configured = updateRounds(
      updateDurationPart(
        updateDurationPart(initialState, 'pause', 'seconds', 12),
        'work',
        'seconds',
        25,
      ),
      3,
    );
    const prepared = prepareTimer(configured);

    expect(prepared.isWorkPhase).toBe(false);
    expect(prepared.timeLeft).toBe(12);
    expect(prepared.remainingRounds).toBe(3);
  });

  it('starts with 5 seconds of rest before the first training', () => {
    const configured = updateDurationPart(initialState, 'pause', 'seconds', 40);
    const started = startTimer(configured);

    expect(started.isRunning).toBe(true);
    expect(started.isWorkPhase).toBe(false);
    expect(started.timeLeft).toBe(OPENING_REST_SECONDS);
    expect(ringOffset(started)).toBeCloseTo(0);
  });

  it('uses the configured rest after the first training', () => {
    const configured = updateDurationPart(
      updateDurationPart(initialState, 'pause', 'seconds', 40),
      'work',
      'seconds',
      20,
    );
    const started = startTimer(configured);
    const work = reduceTick({ ...started, timeLeft: 0 }).state;
    const rest = reduceTick({ ...work, timeLeft: 0 }).state;

    expect(work.isWorkPhase).toBe(true);
    expect(work.timeLeft).toBe(20);
    expect(work.remainingRounds).toBe(5);
    expect(rest.isWorkPhase).toBe(false);
    expect(rest.timeLeft).toBe(40);
    expect(rest.remainingRounds).toBe(4);
  });

  it('switches from rest to work without decreasing remaining rounds', () => {
    const running = {
      ...startTimer(
        updateDurationPart(
          updateRounds(initialState, 4),
          'work',
          'seconds',
          20,
        ),
      ),
      timeLeft: 0,
    };

    const next = reduceTick(running).state;

    expect(next.isWorkPhase).toBe(true);
    expect(next.timeLeft).toBe(20);
    expect(next.remainingRounds).toBe(4);
  });

  it('stops immediately after the final work phase', () => {
    const running = {
      ...startTimer(initialState),
      isWorkPhase: true,
      remainingRounds: 1,
      timeLeft: 0,
    };

    const next = reduceTick(running).state;

    expect(next.isRunning).toBe(false);
    expect(next.isWorkPhase).toBe(false);
  });

  it('resets to the start position when stopping the timer', () => {
    const running = {
      ...startTimer(updateRounds(updateDurationPart(initialState, 'pause', 'seconds', 15), 6)),
      isPaused: true,
      isWorkPhase: true,
      timeLeft: 3,
      remainingRounds: 2,
    };

    const stopped = stopTimer(running);

    expect(stopped.isRunning).toBe(false);
    expect(stopped.isPaused).toBe(false);
    expect(stopped.isWorkPhase).toBe(false);
    expect(stopped.timeLeft).toBe(15);
    expect(stopped.remainingRounds).toBe(6);
  });

  it('plays a long beep when the countdown reaches zero', () => {
    const running = { ...startTimer(initialState), timeLeft: 1 };
    const ticked = reduceTick(running);

    expect(ticked.state.timeLeft).toBe(0);
    expect(ticked.beep).toBe('long');
  });

  it('keeps a single elapsed second identical to one tick', () => {
    const running = { ...startTimer(initialState), timeLeft: 4 };
    const advanced = advanceTimer(running, 1);
    const ticked = reduceTick(running);

    expect(advanced).toEqual(ticked);
  });

  it('catches up elapsed time after the app was in the background', () => {
    const configured = updateDurationPart(
      updateDurationPart(updateRounds(initialState, 2), 'work', 'seconds', 20),
      'pause',
      'seconds',
      40,
    );
    const started = startTimer(configured);

    const intoWork = advanceTimer(started, OPENING_REST_SECONDS + 1);
    expect(intoWork.state.isWorkPhase).toBe(true);
    expect(intoWork.state.timeLeft).toBe(20);
    expect(intoWork.state.remainingRounds).toBe(2);
    expect(intoWork.beep).toBeNull();

    const intoRest = advanceTimer(intoWork.state, 21);
    expect(intoRest.state.isWorkPhase).toBe(false);
    expect(intoRest.state.timeLeft).toBe(40);
    expect(intoRest.state.remainingRounds).toBe(1);

    const finished = advanceTimer(started, 10_000);
    expect(finished.state.isRunning).toBe(false);
    expect(finished.state.isWorkPhase).toBe(false);
    expect(finished.beep).toBeNull();
  });

  it('does not advance a paused timer', () => {
    const paused = { ...startTimer(initialState), isPaused: true, timeLeft: 4 };

    expect(advanceTimer(paused, 30).state).toEqual(paused);
  });
});
