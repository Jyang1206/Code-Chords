import React, { useMemo, useRef, useState } from "react";
import LearnFretboard from "../learn/LearnFretboard";
import CircleOfFifths from "../learn/CircleOfFifths";
import { DOT } from "../learn/boardShader";
import {
  CIRCLE, DEGREE, DIATONIC, FRETS, INTERVALS, INVERSIONS, NATURALS, SCALES, STRING_SETS, TRIADS,
  chordName, midiAt, noteName, pcAt, prefersFlats, stepPattern, triadById, triadShapes,
} from "../learn/theory";
import "../css/Learn.css";

const LESSONS = [
  { id: "notes", label: "Notes" },
  { id: "intervals", label: "Intervals" },
  { id: "scales", label: "Scales" },
  { id: "triads", label: "Triads" },
  { id: "circle", label: "Circle of fifths" },
];

const WINDOWS = [
  { id: "all", label: "Whole neck", lo: 0, hi: FRETS },
  { id: "0", label: "Frets 0–4", lo: 0, hi: 4 },
  { id: "2", label: "Frets 2–6", lo: 2, hi: 6 },
  { id: "5", label: "Frets 5–9", lo: 5, hi: 9 },
  { id: "7", label: "Frets 7–11", lo: 7, hi: 11 },
  { id: "9", label: "Frets 9–13", lo: 9, hi: 13 },
  { id: "12", label: "Frets 12–15", lo: 11, hi: 15 },
];

const empty = () => new Array(96).fill(0);
const idx = (s, f) => s * 16 + f;
const eachPos = (fn) => { for (let s = 0; s < 6; s++) for (let f = 0; f <= FRETS; f++) fn(s, f); };

// positions to play a list of pitches, preferring lit dots and lower frets
function placeMidis(midis, dots, window) {
  return midis.map((m) => {
    let best = null;
    let cost = 1e9;
    eachPos((s, f) => {
      if (midiAt(s, f) !== m) return;
      const code = dots[idx(s, f)];
      const lit = code && code < 10 && code !== DOT.GHOST;
      const inWin = !window || (f >= window.lo && f <= window.hi);
      const c = (lit ? 0 : 100) + (inWin ? 0 : 50) + f;
      if (c < cost) { cost = c; best = { s, f }; }
    });
    return best;
  }).filter(Boolean);
}

function Segmented({ label, options, value, onChange, mono }) {
  return (
    <div className="lr-field">
      <span className="lr-field-label">{label}</span>
      <div className={`lr-seg${mono ? " is-mono" : ""}`} role="group" aria-label={label}>
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            aria-pressed={o.value === value}
            className={o.value === value ? "is-on" : ""}
            onClick={() => onChange(o.value)}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function Select({ label, value, onChange, options }) {
  return (
    <label className="lr-field">
      <span className="lr-field-label">{label}</span>
      <select className="lr-select" value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </label>
  );
}

function sigText(sig) {
  if (!sig) return "no sharps or flats";
  if (sig.includes("/")) return "6 sharps or 6 flats";
  const n = parseInt(sig, 10);
  return `${n} ${sig.includes("♯") ? "sharp" : "flat"}${n > 1 ? "s" : ""}`;
}

const KEY_OPTIONS = Array.from({ length: 12 }, (_, pc) => ({ value: pc, label: noteName(pc, prefersFlats(pc)) }));

export default function Learn() {
  const board = useRef(null);
  const [lesson, setLesson] = useState("notes");
  const [labels, setLabels] = useState("names");

  // lesson state
  const [notePc, setNotePc] = useState(0);
  const [showNaturals, setShowNaturals] = useState(true);
  const [ivRoot, setIvRoot] = useState(9);
  const [ivIdx, setIvIdx] = useState(6);
  const [scRoot, setScRoot] = useState(9);
  const [scId, setScId] = useState("minor-pent");
  const [scWin, setScWin] = useState("all");
  const [trRoot, setTrRoot] = useState(0);
  const [trId, setTrId] = useState("maj");
  const [trSet, setTrSet] = useState("123");
  const [trInv, setTrInv] = useState(0);
  const [trShape, setTrShape] = useState(0);
  const [cofDir, setCofDir] = useState("fifths");
  const [cofKey, setCofKey] = useState(0);
  const [cofChord, setCofChord] = useState(-1);

  const view = useMemo(() => {
    const dots = empty();
    let root = 0;
    let flats = false;
    let degreeOf = (pc) => DEGREE[(pc - root + 12) % 12];
    let play = [];
    let win = null;
    let legend = [];

    if (lesson === "notes") {
      root = notePc;
      flats = prefersFlats(notePc);
      eachPos((s, f) => {
        const pc = pcAt(s, f);
        if (pc === notePc) dots[idx(s, f)] = DOT.ROOT;
        else if (showNaturals && NATURALS.includes(pc)) dots[idx(s, f)] = DOT.GHOST;
      });
      const ms = new Set();
      eachPos((s, f) => { if (pcAt(s, f) === notePc) ms.add(midiAt(s, f)); });
      play = placeMidis([...ms].sort((a, b) => a - b), dots);
      legend = [[DOT.ROOT, `Every ${noteName(notePc, flats)}`], ...(showNaturals ? [[DOT.GHOST, "Other natural notes"]] : [])];
    }

    if (lesson === "intervals") {
      root = ivRoot;
      flats = prefersFlats(ivRoot);
      const iv = INTERVALS[ivIdx];
      const other = (ivRoot + iv.semis) % 12;
      eachPos((s, f) => {
        const pc = pcAt(s, f);
        if (pc === ivRoot) dots[idx(s, f)] = DOT.ROOT;
        else if (pc === other) dots[idx(s, f)] = DOT.THIRD;
      });
      degreeOf = (pc) => (pc === ivRoot ? "1" : iv.short);
      // root on the low strings, then the interval above it
      let r = 40;
      while (r % 12 !== ivRoot) r++;
      play = placeMidis([r, r + iv.semis, r, r + iv.semis], dots);
      legend = [[DOT.ROOT, `Root (${noteName(ivRoot, flats)})`], [DOT.THIRD, `${iv.name} (${noteName(other, flats)})`]];
    }

    if (lesson === "scales") {
      root = scRoot;
      const scale = SCALES.find((x) => x.id === scId);
      const minorish = scale.steps.includes(3);
      flats = prefersFlats(scRoot, minorish);
      win = WINDOWS.find((w) => w.id === scWin);
      const set = new Set(scale.steps.map((i) => (scRoot + i) % 12));
      eachPos((s, f) => {
        const pc = pcAt(s, f);
        if (!set.has(pc)) return;
        const code = pc === scRoot ? DOT.ROOT : DOT.TONE;
        const inWin = f >= win.lo && f <= win.hi;
        dots[idx(s, f)] = scWin === "all" || inWin ? code : code + 10;
      });
      // one octave up and back down from the lowest root in reach
      let r = 40;
      while (r % 12 !== scRoot || (scWin !== "all" && !placeMidis([r], dots, win).some((p) => p.f >= win.lo && p.f <= win.hi))) {
        r++;
        if (r > 64) { r = 40; while (r % 12 !== scRoot) r++; break; }
      }
      const up = [...scale.steps.map((i) => r + i), r + 12];
      play = placeMidis([...up, ...up.slice(0, -1).reverse()], dots, scWin === "all" ? null : win);
      legend = [[DOT.ROOT, `Root (${noteName(scRoot, flats)})`], [DOT.TONE, "Scale tones"], ...(scWin !== "all" ? [[DOT.TONE + 10, "Outside this position"]] : [])];
    }

    if (lesson === "triads" || (lesson === "circle" && cofChord >= 0)) {
      let tRoot = trRoot;
      let triad = triadById(trId);
      if (lesson === "circle") {
        const d = DIATONIC[cofChord];
        tRoot = (CIRCLE[cofKey].pc + d.offset) % 12;
        triad = triadById(d.triad);
        flats = prefersFlats(CIRCLE[cofKey].pc);
      } else {
        flats = prefersFlats(trRoot, trId === "min" || trId === "dim");
      }
      root = tRoot;
      const roleCode = [DOT.ROOT, DOT.THIRD, DOT.FIFTH];
      const tonePcs = triad.tones.map((t) => (tRoot + t) % 12);
      degreeOf = (pc) => {
        const i = tonePcs.indexOf(pc);
        if (i === 0) return "1";
        if (i === 1) return triad.tones[1] === 4 ? "3" : "♭3";
        if (i === 2) return triad.tones[2] === 7 ? "5" : triad.tones[2] === 6 ? "♭5" : "♯5";
        return "";
      };
      if (lesson === "triads") {
        const set = STRING_SETS.find((x) => x.id === trSet);
        const shapes = triadShapes(tRoot, triad, set, trInv);
        const shape = shapes.length ? shapes[trShape % shapes.length] : [];
        eachPos((s, f) => {
          const i = tonePcs.indexOf(pcAt(s, f));
          if (i >= 0) dots[idx(s, f)] = roleCode[i] + 10;
        });
        shape.forEach(({ s, f, role }) => { dots[idx(s, f)] = roleCode[role]; });
        play = shape.length ? [...shape, ...shape] : [];
        legend = [[DOT.ROOT, "Root"], [DOT.THIRD, "Third"], [DOT.FIFTH, "Fifth"], [DOT.ROOT + 10, "Same notes elsewhere"]];
        return { dots, root, flats, degreeOf, play, legend, shapes: shapes.length, shapeAt: shape };
      }
      // circle: a diatonic chord, every tone on the neck
      eachPos((s, f) => {
        const i = tonePcs.indexOf(pcAt(s, f));
        if (i >= 0) dots[idx(s, f)] = roleCode[i];
      });
      let r = 40;
      while (r % 12 !== tRoot) r++;
      play = placeMidis([r, r + triad.tones[1], r + triad.tones[2], r + 12], dots);
      legend = [[DOT.ROOT, "Root"], [DOT.THIRD, "Third"], [DOT.FIFTH, "Fifth"]];
    } else if (lesson === "circle") {
      const key = CIRCLE[cofKey];
      root = key.pc;
      flats = prefersFlats(key.pc);
      const set = new Set(SCALES[0].steps.map((i) => (key.pc + i) % 12));
      eachPos((s, f) => {
        const pc = pcAt(s, f);
        if (set.has(pc)) dots[idx(s, f)] = pc === key.pc ? DOT.ROOT : DOT.TONE;
      });
      let r = 40;
      while (r % 12 !== key.pc) r++;
      play = placeMidis([...SCALES[0].steps.map((i) => r + i), r + 12], dots);
      legend = [[DOT.ROOT, `Root (${noteName(key.pc, flats)})`], [DOT.TONE, `${key.major.split("/")[0]} major scale`]];
    }

    return { dots, root, flats, degreeOf, play, legend };
  }, [lesson, notePc, showNaturals, ivRoot, ivIdx, scRoot, scId, scWin, trRoot, trId, trSet, trInv, trShape, cofKey, cofChord]);

  const label = (s, f) => {
    const pc = pcAt(s, f);
    return labels === "degrees" ? view.degreeOf(pc) : noteName(pc, view.flats);
  };
  const describe = (s, f) => noteName(pcAt(s, f), view.flats);
  const playNow = () => board.current?.play(view.play, lesson === "triads" ? 0.28 : 0.3);

  const triad = triadById(trId);
  const set = STRING_SETS.find((x) => x.id === trSet);
  const scale = SCALES.find((x) => x.id === scId);
  const iv = INTERVALS[ivIdx];
  const key = CIRCLE[cofKey];
  const keyFlats = prefersFlats(key.pc);

  return (
    <div className="learn-page">
      <header className="page-head">
        <h1>Learn the fretboard</h1>
        <p>
          Theory you can see on the neck. Pick a lesson, change the settings, and click any dot to hear it.
        </p>
      </header>

      <nav className="lr-tabs" aria-label="Lessons">
        {LESSONS.map((l) => (
          <button
            key={l.id}
            type="button"
            className={lesson === l.id ? "is-on" : ""}
            aria-current={lesson === l.id ? "page" : undefined}
            onClick={() => setLesson(l.id)}
          >
            {l.label}
          </button>
        ))}
      </nav>

      <section className="lr-stage" aria-label="Fretboard">
        <LearnFretboard ref={board} dots={view.dots} label={label} describe={describe} />
        <div className="lr-stage-bar">
          <ul className="lr-legend">
            {view.legend.map(([code, text]) => (
              <li key={text}><span className={`lr-swatch role-${code >= 10 ? code - 10 : code}${code >= 10 ? " is-dim" : ""}`} />{text}</li>
            ))}
          </ul>
          <div className="lr-stage-tools">
            <div className="lr-seg is-small" role="group" aria-label="Dot labels">
              <button type="button" className={labels === "names" ? "is-on" : ""} aria-pressed={labels === "names"} onClick={() => setLabels("names")}>Note names</button>
              <button type="button" className={labels === "degrees" ? "is-on" : ""} aria-pressed={labels === "degrees"} onClick={() => setLabels("degrees")}>Degrees</button>
            </div>
            <button type="button" className="btn-walnut lr-play" onClick={playNow} disabled={!view.play.length}>
              <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true"><path d="M4 2.5v11l9-5.5z" fill="currentColor" /></svg>
              Play
            </button>
          </div>
        </div>
      </section>

      <section className="lr-lesson">
        {lesson === "notes" && (
          <>
            <div className="lr-controls">
              <Segmented label="Note" mono options={KEY_OPTIONS} value={notePc} onChange={setNotePc} />
              <label className="lr-check">
                <input type="checkbox" checked={showNaturals} onChange={(e) => setShowNaturals(e.target.checked)} />
                Show the other natural notes
              </label>
            </div>
            <article className="lr-text">
              <h2>Find any note, anywhere</h2>
              <p>
                There are only twelve notes. After the 12th fret they repeat, one octave higher, so learning
                frets 0 to 12 teaches you the whole neck.
              </p>
              <ul>
                <li>The natural notes are A B C D E F G. Between each pair sits a sharp or flat, except between <strong>B–C</strong> and <strong>E–F</strong>, which are only one fret apart.</li>
                <li>Learn the notes on the low E and A strings first. Every chord shape and scale pattern is named from a root on one of those two strings.</li>
                <li>Octave shapes link the rest: from a note on the low E, go <strong>two strings up, two frets up</strong> for the same note an octave higher. Crossing from the G to the B string adds one fret.</li>
                <li>The high e string has exactly the same notes as the low E, two octaves up.</li>
              </ul>
            </article>
          </>
        )}

        {lesson === "intervals" && (
          <>
            <div className="lr-controls">
              <Segmented label="Root" mono options={KEY_OPTIONS} value={ivRoot} onChange={setIvRoot} />
              <Segmented
                label="Interval"
                mono
                options={INTERVALS.map((x, i) => ({ value: i, label: x.short }))}
                value={ivIdx}
                onChange={setIvIdx}
              />
            </div>
            <article className="lr-text">
              <h2>{iv.name} <span className="lr-meta">{iv.semis} {iv.semis === 1 ? "fret" : "frets"}</span></h2>
              <p>{iv.tip}</p>
              <p>
                An interval is the distance between two notes, counted in frets (semitones). Because the
                strings are tuned in fourths, every interval has a fixed <em>shape</em> you can move anywhere.
                The one exception is the B string, tuned a major third above G: any shape that crosses from
                the G string to the B string moves up one fret.
              </p>
            </article>
          </>
        )}

        {lesson === "scales" && (
          <>
            <div className="lr-controls">
              <Segmented label="Root" mono options={KEY_OPTIONS} value={scRoot} onChange={setScRoot} />
              <div className="lr-row">
                <Select label="Scale" value={scId} onChange={setScId} options={SCALES.map((x) => ({ value: x.id, label: x.name }))} />
                <Select label="Position" value={scWin} onChange={setScWin} options={WINDOWS.map((w) => ({ value: w.id, label: w.label }))} />
              </div>
            </div>
            <article className="lr-text">
              <h2>{noteName(scRoot, view.flats)} {scale.name.toLowerCase()}</h2>
              <p>{scale.about}</p>
              <dl className="lr-facts">
                <div><dt>Formula</dt><dd>{scale.steps.map((i) => DEGREE[i]).join("  ")}</dd></div>
                <div><dt>Steps</dt><dd>{stepPattern(scale.steps).join("  ")}</dd></div>
                <div><dt>Notes</dt><dd>{scale.steps.map((i) => noteName(scRoot + i, view.flats)).join("  ")}</dd></div>
              </dl>
              <p>
                Learn a scale one position at a time: choose a five-fret window, play it until it's automatic,
                then move to the next one. Neighbouring positions overlap, and they join into the whole neck.
              </p>
            </article>
          </>
        )}

        {lesson === "triads" && (
          <>
            <div className="lr-controls">
              <Segmented label="Root" mono options={KEY_OPTIONS} value={trRoot} onChange={(v) => { setTrRoot(v); setTrShape(0); }} />
              <Segmented label="Quality" options={TRIADS.map((t) => ({ value: t.id, label: t.name }))} value={trId} onChange={(v) => { setTrId(v); setTrShape(0); }} />
              <Segmented label="Strings" options={STRING_SETS.map((x) => ({ value: x.id, label: x.names }))} value={trSet} onChange={(v) => { setTrSet(v); setTrShape(0); }} />
              <Segmented label="Inversion" options={INVERSIONS.map((x) => ({ value: x.id, label: x.name }))} value={trInv} onChange={(v) => { setTrInv(v); setTrShape(0); }} />
              <div className="lr-row">
                <button type="button" className="btn-ghost" disabled={(view.shapes || 0) < 2} onClick={() => setTrShape((n) => n + 1)}>
                  Next shape up the neck
                </button>
                <span className="lr-meta">
                  {view.shapes ? `Shape ${(trShape % view.shapes) + 1} of ${view.shapes}` : "No shape fits here"}
                </span>
              </div>
            </div>
            <article className="lr-text">
              <h2>{chordName(trRoot, triad, view.flats)} <span className="lr-meta">{triad.formula}</span></h2>
              <p>{triad.about}</p>
              <p>
                A triad is three notes: a root, a third and a fifth. On three neighbouring strings
                ({set.label.toLowerCase()}, {set.names}) each triad has three shapes, one for each
                <strong> inversion</strong>: which chord tone sits on the bottom. {INVERSIONS[trInv].about}
              </p>
              <p>
                Learn the three inversions on one string set and you can play any major or minor chord
                within a few frets of where your hand already is. That is how session players comp
                without moving far.
              </p>
            </article>
          </>
        )}

        {lesson === "circle" && (
          <div className="lr-circle">
            <div className="lr-circle-wheel">
              <div className="lr-seg is-small" role="group" aria-label="Direction">
                <button type="button" className={cofDir === "fifths" ? "is-on" : ""} aria-pressed={cofDir === "fifths"} onClick={() => setCofDir("fifths")}>Fifths</button>
                <button type="button" className={cofDir === "fourths" ? "is-on" : ""} aria-pressed={cofDir === "fourths"} onClick={() => setCofDir("fourths")}>Fourths</button>
              </div>
              <CircleOfFifths direction={cofDir} selected={cofKey} onSelect={(k) => { setCofKey(k); setCofChord(-1); }} />
            </div>
            <div className="lr-circle-side">
              <article className="lr-text">
                <h2>
                  {key.major.split("/")[0]} major <span className="lr-meta">{sigText(key.sig)}</span>
                </h2>
                <p>
                  Going clockwise, each key is a <strong>{cofDir === "fifths" ? "fifth higher" : "fourth higher"}</strong>
                  {cofDir === "fifths"
                    ? " and adds one sharp (or loses one flat)."
                    : " and adds one flat (or loses one sharp). It is the same circle read the other way, and it is the order most jazz and blues progressions move in."}
                </p>
                <p>
                  Neighbouring keys share six of their seven notes, which is why moving between them sounds
                  smooth. The keys either side of {key.major.split("/")[0]} are its <strong>IV</strong> and <strong>V</strong> chords. The inner
                  ring is the relative minor: same notes, a different home ({key.minor}).
                </p>
              </article>
              <div className="lr-diatonic">
                <span className="lr-field-label">Chords in {key.major.split("/")[0]} major</span>
                <div className="lr-chords">
                  <button type="button" className={cofChord === -1 ? "is-on" : ""} aria-pressed={cofChord === -1} onClick={() => setCofChord(-1)}>
                    <b>Scale</b><small>all 7 notes</small>
                  </button>
                  {DIATONIC.map((d, i) => (
                    <button key={d.roman} type="button" className={cofChord === i ? "is-on" : ""} aria-pressed={cofChord === i} onClick={() => setCofChord(i)}>
                      <b>{d.roman}</b>
                      <small>{chordName((key.pc + d.offset) % 12, triadById(d.triad), keyFlats)}</small>
                    </button>
                  ))}
                </div>
                <p className="lr-hint">
                  Major keys always follow the same pattern: I, IV and V are major, ii, iii and vi are minor,
                  and vii is diminished. I–IV–V and I–V–vi–IV are a good place to start.
                </p>
              </div>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
