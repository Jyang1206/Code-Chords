import React, { useMemo } from "react";
import "../css/Fretboard.css";

/*
  A walnut neck floating in space. The notes of a scale are drawn as stars,
  and one playable position is joined up like a constellation.
*/

const NAMES = ["C", "C♯", "D", "D♯", "E", "F", "F♯", "G", "G♯", "A", "A♯", "B"];
// top-to-bottom as you look down at the guitar: high e … low E
const TUNING = [4, 11, 7, 2, 9, 4];
const STRING_GAUGE = [1.1, 1.4, 1.8, 2.4, 3.0, 3.6];

const W = 1400;
const H = 300;
const NUT = 74;
const FRETS = 15;
const SCALE = (W - 40 - NUT) / (1 - Math.pow(2, -FRETS / 12));
const TOP = 30;
const BOTTOM = H - 30;
const stringY = (i) => TOP + 22 + i * ((BOTTOM - TOP - 44) / 5);
const fretX = (n) => NUT + SCALE * (1 - Math.pow(2, -n / 12));
const noteX = (f) => (f === 0 ? NUT - 34 : (fretX(f - 1) + fretX(f)) / 2);

export default function Fretboard({
  root = 9, // A
  intervals = [0, 3, 5, 7, 10], // minor pentatonic
  shape = [[5, 8], [5, 8], [5, 7], [5, 7], [5, 7], [5, 8]], // per string, top-to-bottom
  className = "",
}) {
  const scaleSet = useMemo(() => new Set(intervals.map((i) => (root + i) % 12)), [root, intervals]);

  const notes = useMemo(() => {
    const out = [];
    TUNING.forEach((open, s) => {
      for (let f = 0; f <= FRETS; f++) {
        const pc = (open + f) % 12;
        if (!scaleSet.has(pc)) continue;
        const inShape = shape[s] && shape[s].includes(f);
        out.push({ s, f, pc, x: noteX(f), y: stringY(s), root: pc === root, inShape });
      }
    });
    return out;
  }, [scaleSet, root, shape]);

  // constellation: walk the position from low E up to high e, as you'd play it
  const path = useMemo(() => {
    const pts = [];
    for (let s = TUNING.length - 1; s >= 0; s--) {
      (shape[s] || []).forEach((f) => pts.push([noteX(f), stringY(s)]));
    }
    return pts;
  }, [shape]);
  const shapeOrder = useMemo(() => {
    const order = new Map();
    let i = 0;
    for (let s = TUNING.length - 1; s >= 0; s--) {
      (shape[s] || []).forEach((f) => order.set(`${s}-${f}`, i++));
    }
    return order;
  }, [shape]);

  const pathD = path.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");

  return (
    <svg
      className={`fretboard ${className}`}
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label={`${NAMES[root]} minor pentatonic drawn across a guitar fretboard`}
    >
      <defs>
        <linearGradient id="fb-wood" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#7a4627" />
          <stop offset="0.35" stopColor="#5a321b" />
          <stop offset="1" stopColor="#2c170c" />
        </linearGradient>
        <filter id="fb-grain" x="0" y="0" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency="0.0035 0.09" numOctaves="3" seed="7" />
          <feColorMatrix
            values="0 0 0 0 0.12
                    0 0 0 0 0.06
                    0 0 0 0 0.02
                    0 0 0 1.1 -0.38"
          />
        </filter>
        <linearGradient id="fb-fret" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#6c6a73" />
          <stop offset="0.45" stopColor="#f2f0ee" />
          <stop offset="1" stopColor="#7b7880" />
        </linearGradient>
        <linearGradient id="fb-nut" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#d9ccb0" />
          <stop offset="0.5" stopColor="#fbf3e2" />
          <stop offset="1" stopColor="#c7b796" />
        </linearGradient>
        <radialGradient id="fb-pearl" cx="0.35" cy="0.35" r="0.75">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="0.6" stopColor="#e7e2f3" />
          <stop offset="1" stopColor="#b9b2cf" />
        </radialGradient>
        <linearGradient id="fb-string" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="0.5" stopColor="#c9c6cf" />
          <stop offset="1" stopColor="#6f6c76" />
        </linearGradient>
        <pattern id="fb-wound" width="3" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(60)">
          <rect width="1.2" height="6" fill="rgba(0,0,0,0.35)" />
        </pattern>
        <radialGradient id="fb-amber" cx="0.38" cy="0.32" r="0.8">
          <stop offset="0" stopColor="#fff1c9" />
          <stop offset="0.45" stopColor="#f7c35a" />
          <stop offset="1" stopColor="#c27e14" />
        </radialGradient>
        <radialGradient id="fb-ember" cx="0.38" cy="0.32" r="0.8">
          <stop offset="0" stopColor="#ffd2b0" />
          <stop offset="0.45" stopColor="#f07a3e" />
          <stop offset="1" stopColor="#a63a10" />
        </radialGradient>
        <radialGradient id="fb-halo">
          <stop offset="0" stopColor="#ffc35c" stopOpacity="0.75" />
          <stop offset="1" stopColor="#ffc35c" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="fb-halo-ember">
          <stop offset="0" stopColor="#ff7a3a" stopOpacity="0.8" />
          <stop offset="1" stopColor="#ff7a3a" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="fb-fade" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0.8" stopColor="#fff" />
          <stop offset="1" stopColor="#000" />
        </linearGradient>
        <mask id="fb-fade-mask">
          <rect width={W} height={H} fill="url(#fb-fade)" />
        </mask>
      </defs>

      <g mask="url(#fb-fade-mask)">
        {/* neck */}
        <rect x={NUT - 60} y={TOP} width={W} height={BOTTOM - TOP} fill="url(#fb-wood)" />
        <rect x={NUT - 60} y={TOP} width={W} height={BOTTOM - TOP} filter="url(#fb-grain)" opacity="0.9" />
        {/* binding */}
        <rect x={NUT - 60} y={TOP - 3} width={W} height="4" fill="#e9d7b6" opacity="0.85" />
        <rect x={NUT - 60} y={BOTTOM - 1} width={W} height="4" fill="#e9d7b6" opacity="0.85" />
        <rect x={NUT - 60} y={TOP + 1} width={W} height="10" fill="#000" opacity="0.18" />

        {/* inlays */}
        {[3, 5, 7, 9, 15].map((f) => (
          <circle key={f} cx={noteX(f)} cy={H / 2} r="9" fill="url(#fb-pearl)" opacity="0.85" />
        ))}
        <circle cx={noteX(12)} cy={H / 2 - 52} r="9" fill="url(#fb-pearl)" opacity="0.85" />
        <circle cx={noteX(12)} cy={H / 2 + 52} r="9" fill="url(#fb-pearl)" opacity="0.85" />

        {/* frets */}
        {Array.from({ length: FRETS }, (_, i) => i + 1).map((n) => (
          <g key={n}>
            <rect x={fretX(n) - 1} y={TOP} width="7" height={BOTTOM - TOP} fill="#000" opacity="0.25" />
            <rect x={fretX(n) - 3} y={TOP} width="6" height={BOTTOM - TOP} fill="url(#fb-fret)" />
          </g>
        ))}
        <rect x={NUT - 7} y={TOP - 3} width="14" height={BOTTOM - TOP + 6} fill="url(#fb-nut)" />

        {/* strings */}
        {TUNING.map((_, s) => {
          const y = stringY(s);
          const g = STRING_GAUGE[s];
          return (
            <g key={s}>
              <rect x={NUT} y={y + g * 0.9} width={W} height={g} fill="#000" opacity="0.35" />
              <rect x={0} y={y - g / 2} width={W} height={g} fill="url(#fb-string)" />
              {s >= 3 && <rect x={0} y={y - g / 2} width={W} height={g} fill="url(#fb-wound)" />}
            </g>
          );
        })}
      </g>

      {/* constellation */}
      <path className="fb-constellation" d={pathD} pathLength="1" />

      {/* notes */}
      {notes.map((n) => {
        const order = shapeOrder.get(`${n.s}-${n.f}`);
        return (
          <g
            key={`${n.s}-${n.f}`}
            className={`fb-note${n.inShape ? " in-shape" : ""}${n.root ? " is-root" : ""}`}
            style={{ "--i": n.inShape ? order : 14 + (n.f % 5) }}
            transform={`translate(${n.x.toFixed(1)} ${n.y.toFixed(1)})`}
          >
            <circle className="fb-halo" r="42" fill={n.root ? "url(#fb-halo-ember)" : "url(#fb-halo)"} />
            {n.root && <circle r="24.5" fill="none" stroke="#f6c9a6" strokeWidth="1.5" opacity="0.8" />}
            <circle r="18.5" fill={n.root ? "url(#fb-ember)" : "url(#fb-amber)"} stroke="rgba(40,18,4,0.55)" strokeWidth="1" />
            <text className="fb-label" y="0.5" textAnchor="middle" dominantBaseline="central">
              {NAMES[n.pc]}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
