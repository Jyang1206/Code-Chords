import React from "react";
import { CIRCLE } from "./theory";

const C = 200;
const R_OUT = 192;
const R_MID = 136;
const R_IN = 88;

function sector(r0, r1, a0, a1) {
  const p = (r, a) => [C + r * Math.cos(a), C + r * Math.sin(a)];
  const [x0, y0] = p(r1, a0);
  const [x1, y1] = p(r1, a1);
  const [x2, y2] = p(r0, a1);
  const [x3, y3] = p(r0, a0);
  return `M${x0} ${y0} A${r1} ${r1} 0 0 1 ${x1} ${y1} L${x2} ${y2} A${r0} ${r0} 0 0 0 ${x3} ${y3} Z`;
}

/**
 * direction: "fifths" (clockwise = up a fifth) or "fourths" (clockwise = up a fourth)
 * selected: index into CIRCLE of the chosen major key
 */
export default function CircleOfFifths({ direction, selected, onSelect }) {
  const order = direction === "fifths" ? CIRCLE.map((_, i) => i) : CIRCLE.map((_, i) => (12 - i) % 12);
  const pos = (keyIdx) => order.indexOf(keyIdx);
  const sel = pos(selected);
  const near = new Set([(sel + 1) % 12, (sel + 11) % 12]);

  return (
    <svg className="cof" viewBox="0 0 400 400" role="group" aria-label={`Circle of ${direction}`}>
      <defs>
        <linearGradient id="cof-walnut" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#7a4627" />
          <stop offset="1" stopColor="#3b2112" />
        </linearGradient>
      </defs>
      {order.map((keyIdx, i) => {
        const k = CIRCLE[keyIdx];
        const a0 = ((i - 0.5) * 30 - 90) * (Math.PI / 180);
        const a1 = ((i + 0.5) * 30 - 90) * (Math.PI / 180);
        const am = (i * 30 - 90) * (Math.PI / 180);
        const isSel = i === sel;
        const isNear = near.has(i);
        const lx = (r) => C + r * Math.cos(am);
        const ly = (r) => C + r * Math.sin(am);
        return (
          <g
            key={k.major}
            className={`cof-key${isSel ? " is-selected" : ""}${isNear ? " is-near" : ""}`}
            role="button"
            tabIndex={0}
            aria-pressed={isSel}
            aria-label={`${k.major} major, relative minor ${k.minor}, ${k.sig || "no sharps or flats"}`}
            onClick={() => onSelect(keyIdx)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSelect(keyIdx); }
              if (e.key === "ArrowRight") onSelect(order[(i + 1) % 12]);
              if (e.key === "ArrowLeft") onSelect(order[(i + 11) % 12]);
            }}
          >
            <path className="cof-major" d={sector(R_MID, R_OUT, a0, a1)} />
            <path className="cof-minor" d={sector(R_IN, R_MID, a0, a1)} />
            <text className="cof-major-label" x={lx(167)} y={ly(167)} textAnchor="middle" dominantBaseline="central">
              {k.major.length > 2 ? k.major.split("/")[0] : k.major}
            </text>
            <text className="cof-sig" x={lx(143)} y={ly(143) + (k.major.length > 2 ? 0 : 0)} textAnchor="middle" dominantBaseline="central">
              {k.sig || "–"}
            </text>
            <text className="cof-minor-label" x={lx(112)} y={ly(112)} textAnchor="middle" dominantBaseline="central">
              {k.minor}
            </text>
          </g>
        );
      })}
      <circle cx={C} cy={C} r={R_IN - 6} className="cof-hub" />
      <text x={C} y={C - 10} textAnchor="middle" className="cof-hub-title">
        {direction === "fifths" ? "Fifths" : "Fourths"}
      </text>
      <text x={C} y={C + 14} textAnchor="middle" className="cof-hub-sub">
        clockwise
      </text>
    </svg>
  );
}
