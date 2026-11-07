// A small plucked-string voice for the Learn page: two detuned partials through a lowpass that
// closes as the note decays. Good enough to hear intervals and chord colours; not a guitar sim.
let ctx = null;
let master = null;

function ensure() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.5;
    const comp = ctx.createDynamicsCompressor();
    master.connect(comp).connect(ctx.destination);
  }
  if (ctx.state === "suspended") ctx.resume();
  return ctx;
}

export function pluck(hz, delay = 0, length = 1.6) {
  const ac = ensure();
  if (!ac) return;
  const t = ac.currentTime + delay;
  const out = ac.createGain();
  out.gain.setValueAtTime(0.0001, t);
  out.gain.exponentialRampToValueAtTime(0.32, t + 0.006);
  out.gain.exponentialRampToValueAtTime(0.0001, t + length);
  const lp = ac.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.setValueAtTime(Math.min(9000, hz * 9), t);
  lp.frequency.exponentialRampToValueAtTime(Math.max(300, hz * 1.5), t + length * 0.7);
  lp.Q.value = 0.8;
  lp.connect(out).connect(master);
  [
    ["triangle", 1, 0.9],
    ["sawtooth", 1.003, 0.18],
    ["sine", 2, 0.22],
  ].forEach(([type, mult, gain]) => {
    const o = ac.createOscillator();
    const g = ac.createGain();
    o.type = type;
    o.frequency.setValueAtTime(hz * mult, t);
    g.gain.value = gain;
    o.connect(g).connect(lp);
    o.start(t);
    o.stop(t + length + 0.05);
  });
}
