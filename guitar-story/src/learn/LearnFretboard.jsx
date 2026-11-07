import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { useTheme } from "../contexts/ThemeContext";
import { ASPECT, DOT, FRAGMENT, VERTEX, xPct, yPct } from "./boardShader";
import { FRETS, STRING_NAMES, midiAt, midiToHz, stringNumber } from "./theory";
import { pluck } from "./audio";

const MARKERS = [0, 3, 5, 7, 9, 12, 15];
const ROLE_WORD = { [DOT.ROOT]: "root", [DOT.THIRD]: "third", [DOT.FIFTH]: "fifth", [DOT.OTHER]: "", [DOT.TONE]: "", [DOT.GHOST]: "" };

function useBoardGL(canvasRef, dots, pluckRef, isLight) {
  const glRef = useRef(null);
  const drawRef = useRef(() => {});
  const [ok, setOk] = useState(true);

  useEffect(() => {
    const canvas = canvasRef.current;
    const gl = canvas && canvas.getContext("webgl2", { premultipliedAlpha: true, antialias: false, depth: false });
    if (!gl) { setOk(false); return undefined; }
    const mk = (type, src) => { const sh = gl.createShader(type); gl.shaderSource(sh, src); gl.compileShader(sh); return sh; };
    const vs = mk(gl.VERTEX_SHADER, VERTEX);
    const fs = mk(gl.FRAGMENT_SHADER, FRAGMENT);
    const prog = gl.createProgram();
    gl.attachShader(prog, vs); gl.attachShader(prog, fs);
    gl.bindAttribLocation(prog, 0, "aPos");
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      console.error("Board shader failed:", gl.getProgramInfoLog(prog), gl.getShaderInfoLog(fs));
      setOk(false);
      return undefined;
    }
    const vao = gl.createVertexArray();
    const buf = gl.createBuffer();
    gl.bindVertexArray(vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    const u = Object.fromEntries(["uRes", "uTime", "uDots", "uPluck", "uLight"].map((n) => [n, gl.getUniformLocation(prog, n)]));
    glRef.current = { gl, prog, vao, u, dots: new Float32Array(96), light: 0 };

    let raf = 0;
    const t0 = performance.now();
    const frame = () => {
      raf = 0;
      const g = glRef.current;
      if (!g) return;
      const now = (performance.now() - t0) / 1000;
      const age = (performance.now() - pluckRef.current.at) / 1000;
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.useProgram(prog);
      gl.uniform2f(u.uRes, canvas.width, canvas.height);
      gl.uniform1f(u.uTime, now);
      gl.uniform1fv(u.uDots, g.dots);
      gl.uniform2f(u.uPluck, pluckRef.current.s, age);
      gl.uniform1f(u.uLight, g.light);
      gl.bindVertexArray(vao);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      // keep animating only while a string is still ringing
      if (age < 1.4 && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) raf = requestAnimationFrame(frame);
    };
    drawRef.current = () => { if (!raf) raf = requestAnimationFrame(frame); };

    const resize = () => {
      const r = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.round(r.width * dpr));
      canvas.height = Math.max(1, Math.round(r.height * dpr));
      drawRef.current();
    };
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    resize();

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      gl.deleteProgram(prog); gl.deleteShader(vs); gl.deleteShader(fs);
      gl.deleteBuffer(buf); gl.deleteVertexArray(vao);
      glRef.current = null;
    };
  }, [canvasRef, pluckRef]);

  useEffect(() => {
    const g = glRef.current;
    if (!g) return;
    g.dots.set(dots);
    g.light = isLight ? 1 : 0;
    drawRef.current();
  }, [dots, isLight]);

  return { ok, redraw: () => drawRef.current() };
}

/**
 * dots:   array of 96 codes (string * 16 + fret), see DOT in boardShader.js
 * label:  (s, f) => text shown on the dot
 * describe: (s, f) => text for screen readers
 */
const LearnFretboard = forwardRef(function LearnFretboard({ dots, label, describe }, ref) {
  const canvasRef = useRef(null);
  const pluckRef = useRef({ s: -1, at: -1e9 });
  const { isDarkMode } = useTheme();
  const { ok, redraw } = useBoardGL(canvasRef, dots, pluckRef, !isDarkMode);
  const timers = useRef([]);
  const [ringing, setRinging] = useState(null);

  const sound = (s, f) => {
    pluckRef.current = { s, at: performance.now() };
    setRinging(`${s}-${f}`);
    pluck(midiToHz(midiAt(s, f)));
    redraw();
  };

  useImperativeHandle(ref, () => ({
    // play positions one after another, e.g. a scale or an arpeggio
    play(notes, gap = 0.32) {
      timers.current.forEach(clearTimeout);
      timers.current = notes.map(({ s, f }, i) => setTimeout(() => sound(s, f), i * gap * 1000));
      timers.current.push(setTimeout(() => setRinging(null), notes.length * gap * 1000 + 400));
    },
  }));

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const items = [];
  for (let s = 5; s >= 0; s--) {
    for (let f = 0; f <= FRETS; f++) {
      const code = dots[s * 16 + f];
      if (!code) continue;
      const base = code >= 10 ? code - 10 : code;
      items.push({ s, f, base, dim: code >= 10 || base === DOT.GHOST });
    }
  }

  return (
    <div className="lf">
      <div className="lf-scroll">
        <div className="lf-inner">
          <div className="lf-row">
          <ol className="lf-strings" aria-hidden="true">
            {[5, 4, 3, 2, 1, 0].map((s) => (
              <li key={s} style={{ top: `${yPct(s)}%` }}>{STRING_NAMES[s]}</li>
            ))}
          </ol>
          <div className="lf-board" style={{ aspectRatio: String(ASPECT) }}>
            {ok ? <canvas ref={canvasRef} className="lf-canvas" /> : <div className="lf-nogl">This board needs WebGL2. Try a recent Chrome, Edge, Firefox or Safari.</div>}
            <div className="lf-dots">
              {items.map(({ s, f, base, dim }) => (
                <button
                  key={`${s}-${f}`}
                  type="button"
                  className={`lf-dot role-${base}${dim ? " is-dim" : ""}${ringing === `${s}-${f}` ? " is-ringing" : ""}`}
                  style={{ left: `${xPct(f)}%`, top: `${yPct(s)}%` }}
                  onClick={() => sound(s, f)}
                  aria-label={`${describe ? describe(s, f) : label(s, f)}${ROLE_WORD[base] ? `, ${ROLE_WORD[base]}` : ""}. String ${stringNumber(s)}, ${f === 0 ? "open" : `fret ${f}`}. Play`}
                >
                  <span>{label(s, f)}</span>
                </button>
              ))}
            </div>
          </div>
          </div>
          <ol className="lf-frets" aria-hidden="true">
            {MARKERS.map((f) => (
              <li key={f} style={{ left: `${xPct(f)}%` }}>{f === 0 ? "Open" : f}</li>
            ))}
          </ol>
        </div>
      </div>
    </div>
  );
});

export default LearnFretboard;
