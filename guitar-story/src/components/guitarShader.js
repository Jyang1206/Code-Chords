// WebGL2 fretboard, ported from the portfolio's guitar world (shaders/guitar.ts) and adapted to
// Guitar Story: the board floats over the page's starfield, so everything off the neck is drawn
// with alpha and the neck fades out past the nut instead of running under the headline.
//
// uParams.x = root pitch class (0..11, C = 0)
// uParams.y = scale bitmask (bit n = n semitones above the root; 0 = auto-play through six keys)
// uParams.z = 1 to draw roots distinct (ring, warmer fill)
// uView.xy  = neck centre in uv units (y-normalised), uView.z = zoom, uView.w = tilt in radians

export const AUTO_SCHEDULE = {
  seconds: 7,
  masks: [1193, 2741, 1257, 661, 1709, 1453],
  roots: [9, 7, 4, 2, 9, 0],
};

export const VERTEX = /* glsl */ `#version 300 es
in vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }
`;

export const FRAGMENT = /* glsl */ `#version 300 es
precision highp float;
uniform vec2 uRes;
uniform float uTime;
uniform vec4 uParams;
uniform vec4 uView;
out vec4 outColor;
#define PI 3.14159265
float px;

float hash12(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float hash11(float p) { p = fract(p * .1031); p *= p + 33.33; p *= p + p; return fract(p); }
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3. - 2. * f);
  return mix(mix(hash12(i), hash12(i + vec2(1, 0)), u.x), mix(hash12(i + vec2(0, 1)), hash12(i + vec2(1, 1)), u.x), u.y);
}
float fbm(vec2 p) {
  float a = .5, s = 0.; mat2 m = mat2(1.6, 1.2, -1.2, 1.6);
  for (int i = 0; i < 5; i++) { s += a * vnoise(p); p = m * p; a *= .5; }
  return s;
}
mat2 rot(float a) { float c = cos(a), s = sin(a); return mat2(c, -s, s, c); }
float fill(float d) { return 1. - smoothstep(-px, px, d); }
float stroke(float d, float w) { return 1. - smoothstep(w - px, w + px, abs(d)); }

const float NUT = -.6;
const float SCALE_L = 3.6;
const float STR_GAP = .078;
const int MAX_FRET = 15;
const int LOW_PITCH = 40;
const int HIGH_PITCH = 76;
const float RUN_RATE = 2.6;
float fretX(float n) { return NUT + SCALE_L * (1. - pow(2., -n / 12.)); }

// Standard tuning, MIDI: E2 A2 D3 G3 B3 E4. String 0 is the low E (drawn nearest the viewer).
int openPitch(int s) {
  if (s == 0) return 40;
  if (s == 1) return 45;
  if (s == 2) return 50;
  if (s == 3) return 55;
  if (s == 4) return 59;
  return 64;
}

int gRoot;
int gMask;
int gPre[13];
int gCnt;

bool inScale(int m) {
  int iv = (m - gRoot + 120) % 12;
  return ((gMask >> iv) & 1) == 1;
}
int countBelow(int m) { return (m / 12) * gCnt + gPre[m % 12]; }
int rankOf(int m) { return countBelow(m) - countBelow(LOW_PITCH); }

int prefString(int m) {
  int best = -1;
  float cost = 1e3;
  for (int s = 0; s < 6; s++) {
    int f = m - openPitch(s);
    if (f < 0 || f > MAX_FRET) continue;
    float c = abs(float(f) - 7.5) - float(s) * .01;
    if (c < cost) { cost = c; best = s; }
  }
  return best;
}

// Note names inside the dots: a 3 x 5 pixel font. Glyphs A..G then '#'.
int GLYPH[8] = int[8](23530, 15083, 25166, 15211, 29391, 4815, 27470, 24445);
int LETTER[12] = int[12](2, 2, 3, 3, 4, 5, 5, 6, 6, 0, 0, 1);
bool SHARP(int pc) { return pc == 1 || pc == 3 || pc == 6 || pc == 8 || pc == 10; }
float glyphAt(vec2 q, int g, float cell) {
  vec2 c = floor(vec2(q.x / cell + 1.5, 2.5 - q.y / cell));
  if (c.x < 0. || c.x > 2. || c.y < 0. || c.y > 4.) return 0.;
  return float((GLYPH[g] >> (int(c.y) * 3 + int(c.x))) & 1);
}
float noteLabel(vec2 q, int pc) {
  if (!SHARP(pc)) return glyphAt(q, LETTER[pc], .0046);
  return max(glyphAt(q - vec2(-.0062, 0.), LETTER[pc], .0036), glyphAt(q - vec2(.0068, -.0016), 7, .0026));
}

float noteX(int f) {
  if (f == 0) return NUT - .035;
  float ff = float(f);
  return (fretX(ff - 1.) + fretX(ff)) * .5;
}

// Returns premultiplied colour + alpha.
vec4 scene(vec2 uv) {
  float t = uTime;

  gMask = int(clamp(uParams.y, 0., 4095.) + .5);
  gRoot = int(mod(floor(uParams.x + .5), 12.));
  bool autoPlay = gMask == 0;
  if (autoPlay) {
    int key = int(mod(floor(t / 7.), 6.));
    int masks[6] = int[6](1193, 2741, 1257, 661, 1709, 1453);
    int roots[6] = int[6](9, 7, 4, 2, 9, 0);
    gMask = masks[key];
    gRoot = roots[key];
  }
  bool showRoots = autoPlay || uParams.z > .5;
  gPre[0] = 0;
  for (int i = 0; i < 12; i++) gPre[i + 1] = gPre[i] + (inScale(i) ? 1 : 0);
  gCnt = gPre[12];

  // Stage-light bokeh, half amber and half nebula violet, floating in the page's sky.
  vec3 glow = vec3(0.);
  for (int i = 0; i < 7; i++) {
    float fi = float(i);
    vec2 c = vec2(hash11(fi * 3.1) * 2. - 1., hash11(fi * 5.3) - .5) * vec2(.95, .9);
    c += .03 * vec2(sin(t * .2 + fi), cos(t * .17 + fi));
    float r = .07 + .1 * hash11(fi * 7.9);
    float b = 1. - smoothstep(r * .55, r, length(uv - c));
    vec3 tint = (i % 3 == 0) ? vec3(.34, .26, .7) : mix(vec3(.55, .24, .07), vec3(.75, .4, .12), hash11(fi));
    glow += b * tint * .16;
  }
  vec4 outc = vec4(glow, max(glow.r, max(glow.g, glow.b)));

  vec2 p = rot(uView.w) * ((uv - uView.xy) / uView.z);
  float hw = .245;

  // The neck dissolves into space a little past the nut.
  float reach = smoothstep(NUT - .26, NUT - .05, p.x);

  // soft shadow under the neck, toward the viewer
  float sh = (1. - smoothstep(0., .09, abs(p.y + .03) - hw)) * .55 * reach;
  outc = mix(outc, vec4(0., 0., 0., 1.), sh);

  float edge = fill(abs(p.y) - hw) * reach;
  if (edge > 0.) {
    float grain = fbm(vec2(p.x * 2., p.y * 42.));
    float pores = vnoise(vec2(p.x * 70., p.y * 500.));
    vec3 col = mix(vec3(.22, .1, .055), vec3(.46, .23, .12), grain) * (.86 + .14 * pores);
    // binding
    col = mix(col, vec3(.86, .80, .66), step(hw - .008, abs(p.y)));

    float n = -12. * log2(max(1. - (p.x - NUT) / SCALE_L, 1e-4));
    float nr = floor(n + .5);
    float fx = fretX(nr);
    float df = p.x - fx;
    if (nr >= 1.) {
      col *= 1. - .5 * (1. - smoothstep(.004, .016, df)) * step(0., df);
      float fret = 1. - smoothstep(.0055 - px, .0055 + px, abs(df));
      float cyl = clamp(1. - abs(df) / .0055, 0., 1.);
      col = mix(col, vec3(.74, .74, .72) * (.45 + .7 * cyl) + pow(cyl, 12.) * .3, fret);
    }
    // bone nut
    float dn = p.x - (NUT - .006);
    float nut = 1. - smoothstep(.006 - px, .006 + px, abs(dn));
    col = mix(col, vec3(.88, .84, .74) * (.8 + .2 * clamp(1. - abs(dn) / .006, 0., 1.)), nut);

    // pearl inlays
    float cell = floor(n);
    float mid = (fretX(cell) + fretX(cell + 1.)) * .5;
    float inl = 0.;
    if (cell == 2. || cell == 4. || cell == 6. || cell == 8. || cell == 14.) inl = fill(length(p - vec2(mid, 0.)) - .016);
    if (cell == 11.) inl = max(fill(length(p - vec2(mid, .07)) - .016), fill(length(p - vec2(mid, -.07)) - .016));
    col = mix(col, vec3(.86, .88, .84) + .06 * sin(p.x * 400. + p.y * 300.), inl);

    // play-through: an ascending run over every scale pitch from E2 to E4, wrapping
    int total = max(rankOf(HIGH_PITCH + 1), 1);
    float cursor = mod(t * RUN_RATE, float(total));
    int runStep = int(floor(cursor));
    int curPitch = LOW_PITCH;
    int k = 0;
    for (int m = LOW_PITCH; m <= HIGH_PITCH; m++) {
      if (!inScale(m)) continue;
      if (k == runStep) { curPitch = m; break; }
      k++;
    }
    float pluckString = float(prefString(curPitch));
    float pluckPhase = fract(cursor) / RUN_RATE;

    for (int s = 0; s < 6; s++) {
      float fs = float(s);
      float sy = (fs - 2.5) * STR_GAP;
      float amp = fs == pluckString ? .0055 * exp(-pluckPhase * 5.) : 0.;
      float span = (p.x - NUT) / (SCALE_L * .5);
      float off = amp * sin(PI * clamp(span, 0., 1.)) * sin(t * 70. + fs);
      float ds = p.y - sy - off;
      float th = mix(.0042, .0018, fs / 5.);
      col *= 1. - .35 * (1. - smoothstep(0., .008, abs(ds + .007)));
      float strM = 1. - smoothstep(th - px, th + px, abs(ds));
      float c = clamp(1. - abs(ds) / th, 0., 1.);
      vec3 sc = vec3(.80, .78, .72) * (.35 + .8 * c);
      if (s < 3) sc *= .85 + .15 * sin(p.x * 900.);
      col = mix(col, sc, strM);
    }

    // scale dots: only the 3 x 3 neighbourhood of (fret cell, string) can reach this pixel
    int baseF = int(cell) + 1;
    int baseS = int(floor(p.y / STR_GAP + 3.));
    vec3 amber = vec3(1., .66, .24);
    vec3 rootCol = vec3(1., .42, .17);
    for (int j = -1; j <= 1; j++) {
      int s = baseS + j;
      if (s < 0 || s > 5) continue;
      float yy = (float(s) - 2.5) * STR_GAP;
      for (int i = -1; i <= 1; i++) {
        int f = baseF + i;
        if (f < 0 || f > MAX_FRET) continue;
        int m = openPitch(s) + f;
        if (!inScale(m)) continue;
        bool isRoot = ((m - gRoot + 120) % 12) == 0;
        bool pref = prefString(m) == s;
        float dist = 1e3;
        if (m <= HIGH_PITCH) dist = mod(cursor - float(rankOf(m)) + float(total), float(total));
        float lit = .35 + .65 * exp(-dist * 1.4) * (pref ? 1. : .4);
        float len = length(p - vec2(noteX(f), yy));
        float d = len - .02;
        bool ring = showRoots && isRoot;
        vec3 tone = ring ? rootCol : amber;
        col += tone * (1. - smoothstep(0., .06, len)) * lit * .35;
        col = mix(col, tone * (.75 + .5 * lit), fill(d));
        col = mix(col, vec3(1., .9, .7), stroke(d, .0016) * lit);
        if (ring) col = mix(col, vec3(1., .93, .82) * (.7 + .3 * lit), stroke(d - .0085, .0018));
        if (len < .02 && .02 * uView.z / px > 7.) col = mix(col, vec3(.2, .07, .02), noteLabel(p - vec2(noteX(f), yy), m % 12) * .92);
      }
    }

    // stage light falls on the board from up and to the right
    vec2 lp = uv - (uView.xy + vec2(.12, .12));
    float spot = exp(-dot(lp, lp) * 1.6);
    col *= .55 + 1.0 * spot;
    // film grain on the wood only
    col += (hash12(gl_FragCoord.xy + fract(t) * 91.7) - .5) * .018;
    col = clamp(col, 0., 1.);

    outc = mix(outc, vec4(col, 1.), edge);
  }
  return outc;
}

void main() {
  px = 1.0 / uRes.y;
  vec2 uv = (gl_FragCoord.xy - .5 * uRes) / uRes.y;
  outColor = scene(uv);
}
`;
