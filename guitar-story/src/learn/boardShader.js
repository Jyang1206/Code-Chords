// A flat, straight-on version of the portfolio fretboard for teaching. The neck fills the canvas;
// dots come from uDots (one float per string x fret, see DOT below). Note names are drawn in HTML
// on top so they can be spelled properly (B♭, not A♯) and clicked.

export const BOARD = {
  NUT: -0.6,
  SCALE_L: 3.6,
  STR_GAP: 0.078,
  HW: 0.245,
  FRETS: 15,
  LEFT: -0.6 - 0.11,
};
export const fretX = (n) => BOARD.NUT + BOARD.SCALE_L * (1 - Math.pow(2, -n / 12));
BOARD.RIGHT = fretX(BOARD.FRETS) + 0.05;
BOARD.LEN = BOARD.RIGHT - BOARD.LEFT;
BOARD.SPAN_Y = 2 * BOARD.HW + 0.07; // a little room for the drop shadow
export const noteX = (f) => (f === 0 ? BOARD.NUT - 0.05 : (fretX(f - 1) + fretX(f)) / 2);
// overlay positions in percent of the canvas box (top-left origin); string 5 (high e) on top
export const xPct = (f) => ((noteX(f) - BOARD.LEFT) / BOARD.LEN) * 100;
export const yPct = (s) => (0.5 - ((s - 2.5) * BOARD.STR_GAP) / BOARD.SPAN_Y) * 100;
export const ASPECT = BOARD.LEN / BOARD.SPAN_Y;

// dot codes; add 10 for a dimmed (context) version
export const DOT = { NONE: 0, GHOST: 1, TONE: 2, ROOT: 3, THIRD: 4, FIFTH: 5, OTHER: 6 };

export const VERTEX = /* glsl */ `#version 300 es
in vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }
`;

export const FRAGMENT = /* glsl */ `#version 300 es
precision highp float;
uniform vec2 uRes;
uniform float uTime;
uniform float uDots[96];
uniform vec2 uPluck;     // string index, seconds since plucked (large = still)
uniform float uLight;    // 1 in the light theme
out vec4 outColor;
#define PI 3.14159265
float px;

float hash12(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3. - 2. * f);
  return mix(mix(hash12(i), hash12(i + vec2(1, 0)), u.x), mix(hash12(i + vec2(0, 1)), hash12(i + vec2(1, 1)), u.x), u.y);
}
float fbm(vec2 p) {
  float a = .5, s = 0.; mat2 m = mat2(1.6, 1.2, -1.2, 1.6);
  for (int i = 0; i < 5; i++) { s += a * vnoise(p); p = m * p; a *= .5; }
  return s;
}
float fill(float d) { return 1. - smoothstep(-px, px, d); }
float stroke(float d, float w) { return 1. - smoothstep(w - px, w + px, abs(d)); }

const float NUT = ${BOARD.NUT.toFixed(4)};
const float SCALE_L = ${BOARD.SCALE_L.toFixed(4)};
const float STR_GAP = ${BOARD.STR_GAP.toFixed(4)};
const float HW = ${BOARD.HW.toFixed(4)};
const float LEFT = ${BOARD.LEFT.toFixed(4)};
const float LEN = ${BOARD.LEN.toFixed(5)};
const float DOT_R = .027;
float fretX(float n) { return NUT + SCALE_L * (1. - pow(2., -n / 12.)); }
float noteX(int f) {
  if (f == 0) return NUT - .05;
  float ff = float(f);
  return (fretX(ff - 1.) + fretX(ff)) * .5;
}

vec3 dotTone(int code) {
  if (code == 3) return vec3(1., .42, .17);   // root: ember
  if (code == 4) return vec3(1., .72, .26);   // third: amber
  if (code == 5) return vec3(.62, .56, 1.);   // fifth: nebula violet
  if (code == 6) return vec3(.42, .86, .74);  // seventh / other: mint
  if (code == 1) return vec3(.75, .72, .68);  // ghost
  return vec3(1., .66, .24);                  // scale tone: amber
}

void main() {
  px = LEN / uRes.x;
  vec2 q = gl_FragCoord.xy / uRes;
  vec2 p = vec2(LEFT + q.x * LEN, (q.y - .5) * LEN * uRes.y / uRes.x);

  vec4 outc = vec4(0.);
  // drop shadow beneath the neck
  float sh = (1. - smoothstep(0., .05, abs(p.y + .012) - HW)) * .5;
  float reachL = smoothstep(LEFT, NUT - .04, p.x);
  outc = mix(outc, vec4(0., 0., 0., 1.), sh * reachL * (1. - .6 * uLight));

  float edge = fill(abs(p.y) - HW) * reachL;
  if (edge <= 0.) { outColor = outc; return; }

  float grain = fbm(vec2(p.x * 2., p.y * 42.));
  float pores = vnoise(vec2(p.x * 70., p.y * 500.));
  vec3 col = mix(vec3(.22, .1, .055), vec3(.46, .23, .12), grain) * (.86 + .14 * pores);
  col = mix(col, vec3(.86, .80, .66), step(HW - .008, abs(p.y)));

  float n = -12. * log2(max(1. - (p.x - NUT) / SCALE_L, 1e-4));
  float nr = floor(n + .5);
  float df = p.x - fretX(nr);
  if (nr >= 1.) {
    col *= 1. - .5 * (1. - smoothstep(.004, .016, df)) * step(0., df);
    float fret = 1. - smoothstep(.0055 - px, .0055 + px, abs(df));
    float cyl = clamp(1. - abs(df) / .0055, 0., 1.);
    col = mix(col, vec3(.74, .74, .72) * (.45 + .7 * cyl) + pow(cyl, 12.) * .3, fret);
  }
  float dn = p.x - (NUT - .006);
  float nut = 1. - smoothstep(.006 - px, .006 + px, abs(dn));
  col = mix(col, vec3(.88, .84, .74) * (.8 + .2 * clamp(1. - abs(dn) / .006, 0., 1.)), nut);

  float cell = floor(n);
  float mid = (fretX(cell) + fretX(cell + 1.)) * .5;
  float inl = 0.;
  if (cell == 2. || cell == 4. || cell == 6. || cell == 8. || cell == 14.) inl = fill(length(p - vec2(mid, 0.)) - .016);
  if (cell == 11.) inl = max(fill(length(p - vec2(mid, .07)) - .016), fill(length(p - vec2(mid, -.07)) - .016));
  col = mix(col, vec3(.86, .88, .84) + .06 * sin(p.x * 400. + p.y * 300.), inl);

  for (int s = 0; s < 6; s++) {
    float fs = float(s);
    float sy = (fs - 2.5) * STR_GAP;
    float age = fs == uPluck.x ? uPluck.y : 99.;
    float amp = .006 * exp(-age * 4.);
    float span = (p.x - NUT) / (SCALE_L * .5);
    float off = amp * sin(PI * clamp(span, 0., 1.)) * sin(uTime * 70. + fs);
    float ds = p.y - sy - off;
    float th = mix(.0042, .0018, fs / 5.);
    col *= 1. - .35 * (1. - smoothstep(0., .008, abs(ds + .007)));
    float strM = 1. - smoothstep(th - px, th + px, abs(ds));
    float c = clamp(1. - abs(ds) / th, 0., 1.);
    vec3 sc = vec3(.80, .78, .72) * (.35 + .8 * c);
    if (s < 3) sc *= .85 + .15 * sin(p.x * 900.);
    col = mix(col, sc, strM);
  }

  // dots: only the 3 x 3 neighbourhood of (fret cell, string) can reach this pixel
  int baseF = int(cell) + 1;
  int baseS = int(floor(p.y / STR_GAP + 3.));
  for (int j = -1; j <= 1; j++) {
    int s = baseS + j;
    if (s < 0 || s > 5) continue;
    float yy = (float(s) - 2.5) * STR_GAP;
    for (int i = -1; i <= 1; i++) {
      int f = baseF + i;
      if (f < 0 || f > 15) continue;
      int code = int(uDots[s * 16 + f] + .5);
      if (code == 0) continue;
      bool dim = code >= 10;
      if (dim) code -= 10;
      vec3 tone = dotTone(code);
      float r = code == 1 ? DOT_R * .55 : (dim ? DOT_R * .78 : DOT_R);
      float len = length(p - vec2(noteX(f), yy));
      float d = len - r;
      float lit = dim || code == 1 ? .35 : 1.;
      col += tone * (1. - smoothstep(0., .07, len)) * lit * .32;
      vec3 face = tone * (dim ? .55 : .95);
      // a soft top-left highlight so the dots read as glossy beads
      face *= .85 + .3 * clamp(1. - length(p - vec2(noteX(f) - r * .35, yy + r * .35)) / r, 0., 1.);
      col = mix(col, face, fill(d) * (dim ? .85 : 1.));
      col = mix(col, vec3(1., .92, .76), stroke(d, .0016) * lit);
      if (code == 3 && !dim) col = mix(col, vec3(1., .93, .82), stroke(d - .009, .0018));
    }
  }

  col += (hash12(gl_FragCoord.xy) - .5) * .014;
  outc = mix(outc, vec4(clamp(col, 0., 1.), 1.), edge);
  outColor = outc;
}
`;
