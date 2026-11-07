// Music theory for the Learn page. Pure functions, no React.
//
// Fretboard convention here: string index 0 is the low E (6th string) and 5 is the high e
// (1st string). The board draws index 5 on top, the way tab and chord diagrams read.

export const FRETS = 15; // frets 0..15
export const OPEN_MIDI = [40, 45, 50, 55, 59, 64]; // E2 A2 D3 G3 B3 E4
export const STRING_NAMES = ["E", "A", "D", "G", "B", "e"];
export const stringNumber = (s) => 6 - s; // index 0 (low E) is string 6

const SHARPS = ["C", "C♯", "D", "D♯", "E", "F", "F♯", "G", "G♯", "A", "A♯", "B"];
const FLATS = ["C", "D♭", "D", "E♭", "E", "F", "G♭", "G", "A♭", "A", "B♭", "B"];
export const NATURALS = [0, 2, 4, 5, 7, 9, 11];

export const noteName = (pc, flats = false) => (flats ? FLATS : SHARPS)[((pc % 12) + 12) % 12];
export const pcAt = (s, f) => (OPEN_MIDI[s] + f) % 12;
export const midiAt = (s, f) => OPEN_MIDI[s] + f;
export const midiToHz = (m) => 440 * Math.pow(2, (m - 69) / 12);

// Pick names that suit a key: flats for F, B♭, E♭, A♭, D♭, G♭ and their relative minors.
const FLAT_MAJOR_ROOTS = new Set([5, 10, 3, 8, 1, 6]);
export const prefersFlats = (root, isMinor = false) => FLAT_MAJOR_ROOTS.has(isMinor ? (root + 3) % 12 : root);

/* ---------- Degrees ---------- */
export const DEGREE = ["1", "♭2", "2", "♭3", "3", "4", "♭5", "5", "♭6", "6", "♭7", "7"];

/* ---------- Intervals ---------- */
export const INTERVALS = [
  { semis: 1, short: "m2", name: "Minor second", tip: "One fret up on the same string. The tightest, most tense sound in music." },
  { semis: 2, short: "M2", name: "Major second", tip: "Two frets up. A whole step: the distance between most neighbouring notes in a scale." },
  { semis: 3, short: "m3", name: "Minor third", tip: "Three frets up, or one string higher and two frets back. It gives minor chords their darker colour." },
  { semis: 4, short: "M3", name: "Major third", tip: "One string higher and one fret back. It is what makes a major chord sound bright." },
  { semis: 5, short: "P4", name: "Perfect fourth", tip: "Same fret, one string higher. Most pairs of strings are tuned a fourth apart." },
  { semis: 6, short: "TT", name: "Tritone", tip: "Six frets: exactly half an octave. Unstable, it wants to resolve, which is why dominant chords pull home." },
  { semis: 7, short: "P5", name: "Perfect fifth", tip: "One string higher, two frets up. Root plus fifth is the power chord." },
  { semis: 8, short: "m6", name: "Minor sixth", tip: "The inverse of a major third: flip a major third over and you get a minor sixth." },
  { semis: 9, short: "M6", name: "Major sixth", tip: "Two strings higher and one fret back. Sweet and open; country and soul lean on it." },
  { semis: 10, short: "m7", name: "Minor seventh", tip: "Two strings higher, same fret. Add it to a major triad for the bluesy dominant seventh." },
  { semis: 11, short: "M7", name: "Major seventh", tip: "One fret below the octave. Dreamy and a little unresolved, the colour of a maj7 chord." },
  { semis: 12, short: "P8", name: "Octave", tip: "Two strings higher and two frets up (three on the B string). Same note, higher." },
];

/* ---------- Scales ---------- */
export const SCALES = [
  { id: "major", name: "Major (Ionian)", steps: [0, 2, 4, 5, 7, 9, 11], about: "The reference point for everything else. Its pattern of whole and half steps is W W H W W W H." },
  { id: "minor", name: "Natural minor (Aeolian)", steps: [0, 2, 3, 5, 7, 8, 10], about: "The major scale started from its 6th note. Same notes as its relative major, a sadder centre." },
  { id: "minor-pent", name: "Minor pentatonic", steps: [0, 3, 5, 7, 10], about: "Five notes, no half steps, nothing that clashes. The first scale most rock and blues players learn." },
  { id: "major-pent", name: "Major pentatonic", steps: [0, 2, 4, 7, 9], about: "The minor pentatonic's twin: same shape, three frets lower. Bright and singable." },
  { id: "blues", name: "Blues", steps: [0, 3, 5, 6, 7, 10], about: "Minor pentatonic plus the ♭5, the 'blue note'. Use it as a passing tone, not a place to rest." },
  { id: "dorian", name: "Dorian", steps: [0, 2, 3, 5, 7, 9, 10], about: "Minor with a raised 6th. Darker than major, brighter than natural minor; think funk and Santana." },
  { id: "phrygian", name: "Phrygian", steps: [0, 1, 3, 5, 7, 8, 10], about: "Minor with a ♭2 right above the root, which gives it a Spanish, metal edge." },
  { id: "lydian", name: "Lydian", steps: [0, 2, 4, 6, 7, 9, 11], about: "Major with a raised 4th. Floating and cinematic." },
  { id: "mixolydian", name: "Mixolydian", steps: [0, 2, 4, 5, 7, 9, 10], about: "Major with a ♭7. The sound of a dominant chord, and of a lot of classic rock." },
  { id: "locrian", name: "Locrian", steps: [0, 1, 3, 5, 6, 8, 10], about: "Both the 2nd and 5th are flat, so there is no stable home. Mostly used over diminished chords." },
  { id: "harmonic-minor", name: "Harmonic minor", steps: [0, 2, 3, 5, 7, 8, 11], about: "Natural minor with a raised 7th, so the V chord becomes major and pulls hard back to the root." },
];

export function stepPattern(steps) {
  const all = [...steps, 12];
  return all.slice(1).map((v, i) => {
    const d = v - all[i];
    return d === 1 ? "H" : d === 2 ? "W" : d === 3 ? "W+H" : String(d);
  });
}

/* ---------- Triads ---------- */
export const TRIADS = [
  { id: "maj", name: "Major", suffix: "", tones: [0, 4, 7], formula: "1 3 5", about: "A major third, then a minor third on top. Bright and settled." },
  { id: "min", name: "Minor", suffix: "m", tones: [0, 3, 7], formula: "1 ♭3 5", about: "A minor third, then a major third. Lower the major triad's 3rd by one fret to get here." },
  { id: "dim", name: "Diminished", suffix: "°", tones: [0, 3, 6], formula: "1 ♭3 ♭5", about: "Two minor thirds stacked. Tense; it lives on the 7th degree of the major scale." },
  { id: "aug", name: "Augmented", suffix: "+", tones: [0, 4, 8], formula: "1 3 ♯5", about: "Two major thirds stacked. It divides the octave evenly, so every inversion has the same shape." },
];

// three adjacent strings, low to high (string indices)
export const STRING_SETS = [
  { id: "123", label: "Strings 1–3", names: "G B e", strings: [3, 4, 5] },
  { id: "234", label: "Strings 2–4", names: "D G B", strings: [2, 3, 4] },
  { id: "345", label: "Strings 3–5", names: "A D G", strings: [1, 2, 3] },
  { id: "456", label: "Strings 4–6", names: "E A D", strings: [0, 1, 2] },
];

export const INVERSIONS = [
  { id: 0, name: "Root position", order: [0, 1, 2], about: "Root on the bottom, then the 3rd and 5th." },
  { id: 1, name: "First inversion", order: [1, 2, 0], about: "The 3rd on the bottom. The root has moved up an octave to the top." },
  { id: 2, name: "Second inversion", order: [2, 0, 1], about: "The 5th on the bottom, root in the middle, 3rd on top." },
];

// Every playable voicing of a triad on a string set, lowest first. Each item:
// [{ s, f, role }] where role is 0 root, 1 third, 2 fifth.
export function triadShapes(root, triad, set, inversion) {
  const roles = INVERSIONS[inversion].order;
  const per = set.strings.map((s, i) => {
    const pc = (root + triad.tones[roles[i]]) % 12;
    const frets = [];
    for (let f = 0; f <= FRETS; f++) if (pcAt(s, f) === pc) frets.push(f);
    return frets.map((f) => ({ s, f, role: roles[i] }));
  });
  const out = [];
  for (const a of per[0]) for (const b of per[1]) for (const c of per[2]) {
    const fs = [a.f, b.f, c.f];
    const fretted = fs.filter((x) => x > 0);
    const span = fretted.length ? Math.max(...fretted) - Math.min(...fretted) : 0;
    if (span > 4) continue;
    if (!(midiAt(a.s, a.f) < midiAt(b.s, b.f) && midiAt(b.s, b.f) < midiAt(c.s, c.f))) continue;
    out.push([a, b, c]);
  }
  out.sort((x, y) => Math.min(...x.map((n) => n.f)) - Math.min(...y.map((n) => n.f)));
  return out;
}

export const chordName = (root, triad, flats) => noteName(root, flats) + triad.suffix;

/* ---------- Circle of fifths ---------- */
// clockwise from the top, each step a fifth up
export const CIRCLE = [
  { pc: 0, major: "C", minor: "Am", sig: "" },
  { pc: 7, major: "G", minor: "Em", sig: "1♯" },
  { pc: 2, major: "D", minor: "Bm", sig: "2♯" },
  { pc: 9, major: "A", minor: "F♯m", sig: "3♯" },
  { pc: 4, major: "E", minor: "C♯m", sig: "4♯" },
  { pc: 11, major: "B", minor: "G♯m", sig: "5♯" },
  { pc: 6, major: "F♯/G♭", minor: "D♯m", sig: "6♯/6♭" },
  { pc: 1, major: "D♭", minor: "B♭m", sig: "5♭" },
  { pc: 8, major: "A♭", minor: "Fm", sig: "4♭" },
  { pc: 3, major: "E♭", minor: "Cm", sig: "3♭" },
  { pc: 10, major: "B♭", minor: "Gm", sig: "2♭" },
  { pc: 5, major: "F", minor: "Dm", sig: "1♭" },
];

export const DIATONIC = [
  { roman: "I", offset: 0, triad: "maj" },
  { roman: "ii", offset: 2, triad: "min" },
  { roman: "iii", offset: 4, triad: "min" },
  { roman: "IV", offset: 5, triad: "maj" },
  { roman: "V", offset: 7, triad: "maj" },
  { roman: "vi", offset: 9, triad: "min" },
  { roman: "vii°", offset: 11, triad: "dim" },
];

export const triadById = (id) => TRIADS.find((t) => t.id === id);
