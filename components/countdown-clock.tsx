'use client';

import { useEffect, useRef, useState } from 'react';
import { getBeepVolume, loadBeepVolume, playLongBeep, playShortBeep, setBeepVolume, unlockAudio } from '@/lib/audio';
import {
  RING_CIRCUMFERENCE,
  RING_RADIUS,
  type ClockState,
  formatDuration,
  initialState,
  reduceTick,
  ringOffset,
  showsMinutes,
  startTimer,
  stopTimer,
  togglePause,
  updateDurationPart,
  updateRounds,
} from '@/lib/timer';

export function CountdownClock() {
  const [state, setState] = useState<ClockState>(initialState);
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeField, setActiveField] = useState<SettingsField | null>(null);
  const [replaceOnNextDigit, setReplaceOnNextDigit] = useState(true);
  const [animateTimeModeSwitch, setAnimateTimeModeSwitch] = useState(false);
  const [beepVolume, setBeepVolumeState] = useState(getBeepVolume);
  const stateRef = useRef(state);
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);
  const showedMinutesRef = useRef(showsMinutes(state.timeLeft));
  const menuRef = useRef<HTMLElement>(null);

  stateRef.current = state;

  useEffect(() => {
    setBeepVolumeState(loadBeepVolume());
  }, []);

  useEffect(() => {
    if (!state.isRunning) {
      return;
    }

    const intervalId = window.setInterval(() => {
      const result = reduceTick(stateRef.current);
      const finished = stateRef.current.isRunning && !result.state.isRunning;
      stateRef.current = result.state;
      setState(result.state);

      if (finished) {
        setMenuOpen(true);
      }

      if (result.beep === 'short') {
        playShortBeep();
      } else if (result.beep === 'long') {
        playLongBeep();
      }
    }, 1000);

    return () => window.clearInterval(intervalId);
  }, [state.isRunning]);

  useEffect(() => {
    const nextShowsMinutes = showsMinutes(state.timeLeft);
    if (showedMinutesRef.current === nextShowsMinutes) {
      return;
    }

    showedMinutesRef.current = nextShowsMinutes;
    setAnimateTimeModeSwitch(true);
    const timeoutId = window.setTimeout(() => setAnimateTimeModeSwitch(false), 320);
    return () => window.clearTimeout(timeoutId);
  }, [state.timeLeft]);

  useEffect(() => {
    const keepAwake = () => {
      if (document.visibilityState !== 'visible') {
        return;
      }
      void requestWakeLock(wakeLockRef);
    };

    keepAwake();
    document.addEventListener('visibilitychange', keepAwake);
    window.addEventListener('pointerdown', keepAwake);

    return () => {
      document.removeEventListener('visibilitychange', keepAwake);
      window.removeEventListener('pointerdown', keepAwake);
      void releaseWakeLock(wakeLockRef);
    };
  }, []);

  useEffect(() => {
    if (!menuOpen) {
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      menuRef.current?.focus();
    });

    return () => window.cancelAnimationFrame(frame);
  }, [menuOpen]);

  useEffect(() => {
    if (!menuOpen) {
      setActiveField(null);
    }
  }, [menuOpen]);

  function apply(next: ClockState) {
    stateRef.current = next;
    setState(next);
  }

  function activateField(field: SettingsField) {
    setActiveField(field);
    setReplaceOnNextDigit(true);
  }

  function commitField(field: SettingsField, raw: string) {
    if (field.kind === 'rounds') {
      apply(updateRounds(state, raw || '0'));
      return;
    }

    apply(updateDurationPart(state, field.phase, field.part, raw || '0'));
  }

  function pressDigit(digit: string) {
    if (!activeField) {
      return;
    }

    const current = replaceOnNextDigit ? '' : String(fieldValue(state, activeField));
    const limit = activeField.kind === 'duration' && activeField.part === 'minutes' ? 1 : 4;
    let next = `${current}${digit}`.replace(/^0+(?=\d)/, '');
    if (next.length > limit) {
      next = digit;
    }
    setReplaceOnNextDigit(false);
    commitField(activeField, next);
  }

  function pressBackspace() {
    if (!activeField) {
      return;
    }

    setReplaceOnNextDigit(true);
    commitField(activeField, '0');
  }

  const minutesVisible = showsMinutes(state.timeLeft);
  const phaseClass = state.isWorkPhase ? 'shell--work' : 'shell--rest';

  return (
    <div className={`shell ${phaseClass} ${menuOpen ? 'shell--menu-open' : ''}`}>
      <div
        className="stage"
        role="button"
        tabIndex={0}
        onClick={() => setMenuOpen(true)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            setMenuOpen(true);
          }
        }}
      >
        <div className="countdown-ring">
          <svg className="countdown-ring__svg" viewBox="0 0 100 100" aria-hidden="true">
            <circle className="countdown-ring__track" cx="50" cy="50" r={RING_RADIUS} />
            <circle
              className="countdown-ring__progress"
              cx="50"
              cy="50"
              r={RING_RADIUS}
              strokeDasharray={RING_CIRCUMFERENCE}
              strokeDashoffset={ringOffset(state)}
            />
          </svg>

          <div className="info-top">
            NOG {state.remainingRounds} RONDE{state.remainingRounds === 1 ? '' : 'S'}
          </div>

          <div className="countdown-ring__inner">
            <div className="phase-label">{state.isWorkPhase ? 'TRAINING' : 'RUST'}</div>
            <div
              className={[
                'big-time',
                minutesVisible ? 'big-time--with-minutes' : 'big-time--seconds-only',
                animateTimeModeSwitch ? 'big-time--mode-switch' : '',
              ]
                .filter(Boolean)
                .join(' ')}
            >
              {formatDuration(state.timeLeft)}
            </div>
          </div>
        </div>

        {!menuOpen && (
          <span className="menu-hint">{state.isRunning ? 'Tik voor menu' : 'Tik voor instellingen'}</span>
        )}
      </div>

      <div className="brand-credit">
        <img src="/logo-fysioharlingen.png?v=2" alt="Fysiotherapie en Training" width={92} height={36} />
        <span>© 2026 V 0.1.1</span>
      </div>

      <button
        type="button"
        className="backdrop"
        aria-label="Menu sluiten"
        tabIndex={menuOpen ? 0 : -1}
        onClick={() => setMenuOpen(false)}
      />

      <aside
        ref={menuRef}
        className="menu"
        tabIndex={-1}
        inert={!menuOpen}
        onClick={(event) => event.stopPropagation()}
      >
        <h2>{state.isRunning ? 'Bediening' : 'Instellingen'}</h2>

        {state.isRunning ? (
          <div className="menu-actions">
            <button
              type="button"
              className="round-button"
              onClick={() => {
                const wasPaused = state.isPaused;
                apply(togglePause(state));
                if (wasPaused) {
                  setMenuOpen(false);
                }
              }}
            >
              {state.isPaused ? <PlayIcon /> : <PauseIcon />}
              <span>{state.isPaused ? 'Verder' : 'Pauze'}</span>
            </button>
            <button
              type="button"
              className="round-button"
              onClick={() => apply(stopTimer(state))}
            >
              <StopIcon />
              <span>Stop</span>
            </button>
          </div>
        ) : (
          <>
            <DurationFields
              label="Training"
              phase="work"
              minutes={state.workMinutes}
              seconds={state.workSeconds}
              activeField={activeField}
              onActivate={activateField}
            />
            <DurationFields
              label="Rust"
              phase="pause"
              minutes={state.pauseMinutes}
              seconds={state.pauseSeconds}
              activeField={activeField}
              onActivate={activateField}
            />
            <NumberField
              label="Aantal rondes"
              value={state.totalRounds}
              active={activeField?.kind === 'rounds'}
              onActivate={() => activateField({ kind: 'rounds' })}
            />
            <label className="volume-control">
              <span>
                Volume
                <strong>{Math.round(beepVolume * 100)}%</strong>
              </span>
              <input
                type="range"
                min={0}
                max={100}
                step={1}
                value={Math.round(beepVolume * 100)}
                aria-label="Volume van de piepjes"
                onChange={(event) => {
                  const next = Number(event.currentTarget.value) / 100;
                  setBeepVolumeState(next);
                  setBeepVolume(next);
                }}
                onPointerUp={() => playShortBeep()}
                onKeyUp={() => playShortBeep()}
              />
            </label>
            {activeField && (
              <NumericKeypad
                label={fieldLabel(activeField)}
                onDigit={pressDigit}
                onBackspace={pressBackspace}
                onDone={() => setActiveField(null)}
              />
            )}
            <button
              type="button"
              className="start-button"
              onClick={() => {
                unlockAudio();
                apply(startTimer(state));
                setMenuOpen(false);
              }}
            >
              <PlayIcon />
              Start
            </button>
          </>
        )}
      </aside>
    </div>
  );
}

type SettingsField =
  | { kind: 'duration'; phase: 'work' | 'pause'; part: 'minutes' | 'seconds' }
  | { kind: 'rounds' };

function fieldLabel(field: SettingsField): string {
  if (field.kind === 'rounds') {
    return 'Aantal rondes';
  }

  const phase = field.phase === 'work' ? 'Training' : 'Rust';
  const part = field.part === 'minutes' ? 'minuten' : 'seconden';
  return `${phase}, ${part}`;
}

function fieldValue(state: ClockState, field: SettingsField): number {
  if (field.kind === 'rounds') {
    return state.totalRounds;
  }

  if (field.phase === 'work') {
    return field.part === 'minutes' ? state.workMinutes : state.workSeconds;
  }

  return field.part === 'minutes' ? state.pauseMinutes : state.pauseSeconds;
}

function DurationFields({
  label,
  phase,
  minutes,
  seconds,
  activeField,
  onActivate,
}: {
  label: string;
  phase: 'work' | 'pause';
  minutes: number;
  seconds: number;
  activeField: SettingsField | null;
  onActivate: (field: SettingsField) => void;
}) {
  return (
    <fieldset className="duration-fields">
      <legend>{label}</legend>
      <div className="time-inputs">
        <NumberField
          label="Min"
          value={minutes}
          active={activeField?.kind === 'duration' && activeField.phase === phase && activeField.part === 'minutes'}
          onActivate={() => onActivate({ kind: 'duration', phase, part: 'minutes' })}
        />
        <NumberField
          label="Sec"
          value={seconds}
          active={activeField?.kind === 'duration' && activeField.phase === phase && activeField.part === 'seconds'}
          onActivate={() => onActivate({ kind: 'duration', phase, part: 'seconds' })}
        />
      </div>
    </fieldset>
  );
}

function NumberField({
  label,
  value,
  active,
  onActivate,
}: {
  label: string;
  value: number;
  active: boolean;
  onActivate: () => void;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <input
        readOnly
        inputMode="none"
        value={value}
        className={active ? 'is-active' : undefined}
        aria-label={label}
        onFocus={onActivate}
        onClick={onActivate}
      />
    </label>
  );
}

function NumericKeypad({
  label,
  onDigit,
  onBackspace,
  onDone,
}: {
  label: string;
  onDigit: (digit: string) => void;
  onBackspace: () => void;
  onDone: () => void;
}) {
  const digits = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];

  return (
    <div className="keypad" aria-label={`Numeriek toetsenbord voor ${label}`}>
      <div className="keypad__title">{label}</div>
      <div className="keypad__grid">
        {digits.map((digit) => (
          <button key={digit} type="button" className="keypad__key" onClick={() => onDigit(digit)}>
            {digit}
          </button>
        ))}
        <button type="button" className="keypad__key keypad__key--wide" onClick={onBackspace}>
          Wis
        </button>
        <button type="button" className="keypad__key" onClick={() => onDigit('0')}>
          0
        </button>
        <button type="button" className="keypad__key keypad__key--done" onClick={onDone}>
          OK
        </button>
      </div>
    </div>
  );
}

async function requestWakeLock(wakeLockRef: { current: WakeLockSentinel | null }) {
  if (!('wakeLock' in navigator) || wakeLockRef.current) {
    return;
  }

  try {
    wakeLockRef.current = await navigator.wakeLock.request('screen');
    wakeLockRef.current.addEventListener('release', () => {
      wakeLockRef.current = null;
    });
  } catch (error) {
    if (!(error instanceof DOMException) || error.name !== 'NotAllowedError') {
      console.error('WakeLock failed', error);
    }
  }
}

async function releaseWakeLock(wakeLockRef: { current: WakeLockSentinel | null }) {
  if (!wakeLockRef.current) {
    return;
  }

  try {
    await wakeLockRef.current.release();
  } catch {
    // The lock may already have been released by the browser.
  }

  wakeLockRef.current = null;
}

function PlayIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M8 5.5v13l11-6.5-11-6.5z" />
    </svg>
  );
}

function PauseIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M7 5h3.5v14H7V5zm6.5 0H17v14h-3.5V5z" />
    </svg>
  );
}

function StopIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M6 6h12v12H6V6z" />
    </svg>
  );
}
