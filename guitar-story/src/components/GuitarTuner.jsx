import React, { useEffect, useState } from "react";
import "../css/GuitarTuner.css";
// You need to install pitchy: npm install pitchy
// import { createPitchDetector } from "pitchy";
import AudioPitchDetector from "../utils/AudioPitchDetector";

// Standard guitar string frequencies (Hz)
const GUITAR_STRINGS = [
  { note: "E2", freq: 82.41 },
  { note: "A2", freq: 110.00 },
  { note: "D3", freq: 146.83 },
  { note: "G3", freq: 196.00 },
  { note: "B3", freq: 246.94 },
  { note: "E4", freq: 329.63 },
];

function getClosestString(freq) {
  return GUITAR_STRINGS.reduce((prev, curr) =>
    Math.abs(curr.freq - freq) < Math.abs(prev.freq - freq) ? curr : prev
  );
}

/* ---------- Gauge geometry (presentation only) ---------- */
const GAUGE = { cx: 160, cy: 172, r: 136 };
const SWEEP = 60; // degrees either side of centre for ±50 cents
const CENTS_RANGE = 50;
const centsToDeg = (c) => (Math.max(-CENTS_RANGE, Math.min(CENTS_RANGE, c)) / CENTS_RANGE) * SWEEP;

function polar(deg, r) {
  const rad = (deg * Math.PI) / 180;
  return [GAUGE.cx + r * Math.sin(rad), GAUGE.cy - r * Math.cos(rad)];
}

function arcPath(fromDeg, toDeg, r) {
  const [x1, y1] = polar(fromDeg, r);
  const [x2, y2] = polar(toDeg, r);
  const large = Math.abs(toDeg - fromDeg) > 180 ? 1 : 0;
  return `M ${x1.toFixed(2)} ${y1.toFixed(2)} A ${r} ${r} 0 ${large} 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`;
}

const TICKS = Array.from({ length: 21 }, (_, i) => -50 + i * 5);
const TICK_LABELS = [-50, -25, 0, 25, 50];

function splitNote(n) {
  if (!n) return { letter: "–", octave: "" };
  const m = n.match(/^([A-G][#b]?)(\d)?$/);
  return m ? { letter: m[1], octave: m[2] || "" } : { letter: n, octave: "" };
}

const STATUS_COPY = {
  "In Tune": "In tune",
  "Too Low": "Flat, tighten the string",
  "Too High": "Sharp, loosen the string",
  "No clear pitch": "Play one open string",
};

const GuitarTuner = () => {
  const [tuningStatus, setTuningStatus] = useState("");
  // Track last valid pitch and note
  const [lastFrequency, setLastFrequency] = useState(null);
  const [lastNote, setLastNote] = useState(null);

  return (
    <AudioPitchDetector>
      {({ note, frequency, clarity, listening, start, stop, error }) => {
        // Update lastFrequency/lastNote and tuningStatus as in the old loop
        useEffect(() => {
          if (frequency && note) {
            const closest = getClosestString(frequency);
            setLastFrequency(frequency);
            setLastNote(closest.note);
            const diff = frequency - closest.freq;
            if (Math.abs(diff) < 1) setTuningStatus("In Tune");
            else if (diff < 0) setTuningStatus("Too Low");
            else setTuningStatus("Too High");
          } else {
            setTuningStatus("No clear pitch");
          }
        }, [frequency, note]);

        // Derived display values
        const targetFreq = lastNote ? GUITAR_STRINGS.find(s => s.note === lastNote)?.freq : null;
        const hasReading = Boolean(lastFrequency && targetFreq);
        const cents = hasReading ? 1200 * Math.log2(lastFrequency / targetFreq) : 0;
        const needleDeg = centsToDeg(cents);
        // the in-tune window matches the ±1 Hz rule above, expressed in cents
        const windowCents = targetFreq ? 1200 * Math.log2((targetFreq + 1) / targetFreq) : 5;
        const windowDeg = centsToDeg(windowCents);

        const inTune = hasReading && tuningStatus === "In Tune";
        const idle = !hasReading || tuningStatus === "No clear pitch";
        let state = "idle";
        if (hasReading) {
          if (inTune) state = "ok";
          else if (Math.abs(cents) > 25) state = "far";
          else state = "near";
        }

        const { letter, octave } = splitNote(lastNote);
        const centsLabel = hasReading
          ? `${cents > 0 ? "+" : cents < 0 ? "−" : ""}${Math.abs(cents).toFixed(0)} cents`
          : "– cents";

        let statusText;
        if (!listening && !hasReading) statusText = "Press start, then play one open string";
        else if (!hasReading) statusText = "Listening, play one open string";
        else statusText = STATUS_COPY[tuningStatus] || tuningStatus;

        const [nx, ny] = polar(0, GAUGE.r - 22);

        return (
          <section
            className={`tuner-instrument is-${state}${idle ? " is-faded" : ""}`}
            aria-label="Tuner"
          >
            <div className="tuner-gauge">
              <svg
                className="tuner-gauge-svg"
                viewBox="0 0 320 196"
                role="img"
                aria-label={hasReading ? `${lastNote}, ${centsLabel}` : "No pitch detected"}
              >
                <path className="tg-track" d={arcPath(-SWEEP, SWEEP, GAUGE.r)} />
                <path className="tg-window" d={arcPath(-windowDeg, windowDeg, GAUGE.r)} />
                <g className="tg-ticks">
                  {TICKS.map((c) => {
                    const deg = centsToDeg(c);
                    const major = c % 25 === 0;
                    const [x1, y1] = polar(deg, GAUGE.r - 8);
                    const [x2, y2] = polar(deg, GAUGE.r - (c === 0 ? 30 : major ? 22 : 15));
                    return (
                      <line
                        key={c}
                        className={c === 0 ? "tg-tick tg-tick--zero" : major ? "tg-tick tg-tick--major" : "tg-tick"}
                        x1={x1} y1={y1} x2={x2} y2={y2}
                      />
                    );
                  })}
                </g>
                <g className="tg-labels">
                  {TICK_LABELS.map((c) => {
                    const [x, y] = polar(centsToDeg(c), GAUGE.r + 14);
                    return (
                      <text key={c} x={x} y={y} textAnchor="middle" dominantBaseline="middle">
                        {c > 0 ? `+${c}` : c < 0 ? `−${Math.abs(c)}` : "0"}
                      </text>
                    );
                  })}
                </g>
                <text className="tg-side" x={GAUGE.cx - GAUGE.r + 6} y={GAUGE.cy + 16} textAnchor="start">♭ flat</text>
                <text className="tg-side" x={GAUGE.cx + GAUGE.r - 6} y={GAUGE.cy + 16} textAnchor="end">sharp ♯</text>
                <g
                  className="tg-needle"
                  style={{
                    transform: `rotate(${needleDeg}deg)`,
                    transformOrigin: `${GAUGE.cx}px ${GAUGE.cy}px`,
                  }}
                >
                  <line x1={GAUGE.cx} y1={GAUGE.cy + 10} x2={nx} y2={ny} />
                </g>
                <circle className="tg-pivot" cx={GAUGE.cx} cy={GAUGE.cy} r="7" />
                <circle className="tg-pivot-core" cx={GAUGE.cx} cy={GAUGE.cy} r="2.5" />
              </svg>
            </div>

            <div className="tuner-readout" aria-live="polite">
              <p className="tuner-note-name">
                {letter}
                {octave && <sub>{octave}</sub>}
              </p>
              <p className="tuner-hz">
                {hasReading ? `${lastFrequency.toFixed(2)} Hz` : "– Hz"}
                <span className="tuner-hz-sep" aria-hidden="true">·</span>
                {centsLabel}
              </p>
              <p className="tuner-status">
                {inTune && (
                  <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
                    <path d="M3 8.5l3.2 3L13 4.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
                {statusText}
              </p>
            </div>

            <div className="tuner-controls">
              {!listening ? (
                <button onClick={start} className="btn-walnut tuner-toggle">Start tuner</button>
              ) : (
                <button onClick={stop} className="btn-walnut tuner-toggle">Stop tuner</button>
              )}
            </div>

            {error && (
              <p className="tuner-error" role="alert">
                {error} Allow microphone access for this site, then press Start tuner.
              </p>
            )}

            <div className="tuner-strings">
              <h2 className="tuner-strings-title">Standard tuning</h2>
              <ul>
                {GUITAR_STRINGS.map(s => {
                  const active = s.note === lastNote && hasReading;
                  const n = splitNote(s.note);
                  return (
                    <li
                      key={s.note}
                      className={`string-chip${active ? " is-active" : ""}${active && inTune ? " is-tuned" : ""}`}
                      aria-current={active ? "true" : undefined}
                    >
                      <span className="string-chip-note">
                        {n.letter}<sub>{n.octave}</sub>
                      </span>
                      <span className="string-chip-hz">{s.freq.toFixed(2)}</span>
                    </li>
                  );
                })}
              </ul>
            </div>
          </section>
        );
      }}
    </AudioPitchDetector>
  );
};

export default GuitarTuner;
