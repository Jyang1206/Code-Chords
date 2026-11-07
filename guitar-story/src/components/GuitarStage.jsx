import React, { useEffect, useRef, useState } from "react";
import Fretboard from "./Fretboard";
import { AUTO_SCHEDULE, FRAGMENT, VERTEX } from "./guitarShader";
import "../css/GuitarStage.css";

const KEYS = ["C", "C♯", "D", "D♯", "E", "F", "F♯", "G", "G♯", "A", "A♯", "B"];
// bit n = n semitones above the root
const SCALES = [
  { id: "minor-pent", label: "Minor pentatonic", mask: 1193 },
  { id: "major", label: "Major", mask: 2741 },
  { id: "minor", label: "Natural minor", mask: 1453 },
  { id: "major-pent", label: "Major pentatonic", mask: 661 },
  { id: "blues", label: "Blues", mask: 1257 },
  { id: "dorian", label: "Dorian", mask: 1709 },
];
const scaleByMask = (mask) => SCALES.find((s) => s.mask === mask);

function autoAt(t) {
  const i = Math.floor(t / AUTO_SCHEDULE.seconds) % AUTO_SCHEDULE.masks.length;
  return { root: AUTO_SCHEDULE.roots[i], mask: AUTO_SCHEDULE.masks[i] };
}

// Where the neck sits in the canvas, by layout.
function viewFor(width, height) {
  const aspect = width / height;
  if (width < 760) return [0.02, 0.0, 0.92, 0.3];
  // keep the nut clear of the headline: push the board right on wide screens
  return [Math.min(0.5, aspect * 0.28), -0.03, 0.8, 0.3];
}

function compile(gl) {
  const make = (type, src) => {
    const sh = gl.createShader(type);
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    return sh;
  };
  const vs = make(gl.VERTEX_SHADER, VERTEX);
  const fs = make(gl.FRAGMENT_SHADER, FRAGMENT);
  const prog = gl.createProgram();
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.bindAttribLocation(prog, 0, "aPos");
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    console.error("Guitar shader failed:", gl.getProgramInfoLog(prog), gl.getShaderInfoLog(fs));
    return null;
  }
  return { prog, shaders: [vs, fs] };
}

export default function GuitarStage() {
  const canvasRef = useRef(null);
  const paramsRef = useRef([0, 0, 1, 0]);
  const [supported, setSupported] = useState(true);
  const [key, setKey] = useState("auto");
  const [scale, setScale] = useState("auto");
  const [now, setNow] = useState(autoAt(0));
  const isAuto = key === "auto" && scale === "auto";

  // Translate the pickers into shader params. Picking either one leaves auto-play.
  useEffect(() => {
    if (isAuto) {
      paramsRef.current = [0, 0, 1, 0];
      return;
    }
    const root = key === "auto" ? 9 : Number(key);
    const mask = scale === "auto" ? 1193 : SCALES.find((s) => s.id === scale).mask;
    paramsRef.current = [root, mask, 1, 0];
    setNow({ root, mask });
  }, [key, scale, isAuto]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const gl = canvas && canvas.getContext("webgl2", { premultipliedAlpha: true, antialias: false, depth: false, stencil: false });
    if (!gl) {
      setSupported(false);
      return undefined;
    }
    const built = compile(gl);
    if (!built) {
      setSupported(false);
      return undefined;
    }
    const { prog, shaders } = built;
    const vao = gl.createVertexArray();
    const buf = gl.createBuffer();
    gl.bindVertexArray(vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    const u = {
      res: gl.getUniformLocation(prog, "uRes"),
      time: gl.getUniformLocation(prog, "uTime"),
      params: gl.getUniformLocation(prog, "uParams"),
      view: gl.getUniformLocation(prog, "uView"),
    };

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    let raf = 0;
    let visible = true;
    let start = performance.now();
    let lastAutoIdx = -1;
    let view = [0, 0, 1, 0.3];

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      // a full-screen fragment shader: cap the pixel count so it stays smooth
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      const scale = Math.min(1, 1.6e6 / (rect.width * rect.height * dpr * dpr));
      const w = Math.max(1, Math.round(rect.width * dpr * Math.sqrt(scale)));
      const h = Math.max(1, Math.round(rect.height * dpr * Math.sqrt(scale)));
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
      view = viewFor(rect.width, rect.height);
    };

    const draw = (t) => {
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.useProgram(prog);
      gl.uniform2f(u.res, canvas.width, canvas.height);
      gl.uniform1f(u.time, t);
      gl.uniform4fv(u.params, paramsRef.current);
      gl.uniform4fv(u.view, view);
      gl.bindVertexArray(vao);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      if (paramsRef.current[1] === 0) {
        const idx = Math.floor(t / AUTO_SCHEDULE.seconds) % AUTO_SCHEDULE.masks.length;
        if (idx !== lastAutoIdx) {
          lastAutoIdx = idx;
          setNow(autoAt(t));
        }
      } else {
        lastAutoIdx = -1;
      }
    };

    const loop = () => {
      raf = 0;
      if (!visible || document.hidden) return;
      draw((performance.now() - start) / 1000);
      if (!reduced.matches) raf = requestAnimationFrame(loop);
    };
    const kick = () => {
      if (reduced.matches) {
        draw(1.2); // a still frame with one note mid-highlight
        return;
      }
      if (!raf) raf = requestAnimationFrame(loop);
    };

    resize();
    const ro = new ResizeObserver(() => { resize(); kick(); });
    ro.observe(canvas);
    const io = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; kick(); });
    io.observe(canvas);
    const onVis = () => kick();
    document.addEventListener("visibilitychange", onVis);
    reduced.addEventListener?.("change", kick);
    // redraw immediately when the pickers change, even when animation is off
    const onParams = () => kick();
    canvas.addEventListener("guitar-params", onParams);
    kick();

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      document.removeEventListener("visibilitychange", onVis);
      reduced.removeEventListener?.("change", kick);
      canvas.removeEventListener("guitar-params", onParams);
      shaders.forEach((s) => gl.deleteShader(s));
      gl.deleteProgram(prog);
      gl.deleteBuffer(buf);
      gl.deleteVertexArray(vao);
      start = 0;
    };
  }, []);

  useEffect(() => {
    canvasRef.current?.dispatchEvent(new Event("guitar-params"));
  }, [key, scale]);

  const nowScale = scaleByMask(now.mask);
  const caption = `${KEYS[now.root]} ${nowScale ? nowScale.label.toLowerCase() : "scale"}`;

  return (
    <div className="guitar-stage">
      {supported ? (
        <canvas
          ref={canvasRef}
          className="guitar-stage-canvas"
          role="img"
          aria-label={`A guitar neck playing up the ${caption} scale`}
        />
      ) : (
        <div className="guitar-stage-fallback">
          <Fretboard />
        </div>
      )}

      {supported && (
        <div className="guitar-stage-panel" role="group" aria-label="Key and scale shown on the guitar">
          <p className="guitar-stage-now" aria-live="polite">
            <span className="guitar-stage-dot" aria-hidden="true" />
            {isAuto ? "Playing " : "Showing "}
            <strong>{caption}</strong>
          </p>
          <label className="guitar-stage-field">
            <span>Key</span>
            <select value={key} onChange={(e) => setKey(e.target.value)}>
              <option value="auto">Auto</option>
              {KEYS.map((k, i) => (
                <option key={k} value={i}>{k}</option>
              ))}
            </select>
          </label>
          <label className="guitar-stage-field">
            <span>Scale</span>
            <select value={scale} onChange={(e) => setScale(e.target.value)}>
              <option value="auto">Auto</option>
              {SCALES.map((s) => (
                <option key={s.id} value={s.id}>{s.label}</option>
              ))}
            </select>
          </label>
        </div>
      )}
    </div>
  );
}
