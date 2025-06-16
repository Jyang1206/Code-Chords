// Musical notes and scales definitions
export const ALL_NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
export const OPEN_STRINGS = ['E', 'A', 'D', 'G', 'B', 'E'];  // from 6th string(top) to 1st string(bottom)

export const SCALES = {
    'major': [0, 2, 4, 5, 7, 9, 11],          
    'minor': [0, 2, 3, 5, 7, 8, 10],          
    'pentatonic_major': [0, 2, 4, 7, 9],      
    'pentatonic_minor': [0, 3, 5, 7, 10],     
    'blues': [0, 3, 5, 6, 7, 10],             
    'dorian': [0, 2, 3, 5, 7, 9, 10],         
    'mixolydian': [0, 2, 4, 5, 7, 9, 10],     
    'harmonic_minor': [0, 2, 3, 5, 7, 8, 11], 
    'melodic_minor': [0, 2, 3, 5, 7, 9, 11],  
    'phrygian': [0, 1, 3, 5, 7, 8, 10]        
} as const;

export type ScaleType = keyof typeof SCALES;
export type NoteType = typeof ALL_NOTES[number];

export class FretboardNotes {
    private selectedScaleName: ScaleType;
    private selectedRoot: NoteType;
    private scaleNotes: NoteType[];

    constructor() {
        this.selectedScaleName = 'major';
        this.selectedRoot = 'C';
        this.scaleNotes = this.calculateScaleNotes();
    }

    private calculateScaleNotes(): NoteType[] {
        const rootIndex = ALL_NOTES.indexOf(this.selectedRoot);
        const scaleIntervals = SCALES[this.selectedScaleName];
        
        return scaleIntervals.map(interval => 
            ALL_NOTES[(rootIndex + interval) % 12]
        );
    }

    public setScale(root: NoteType, scaleName: ScaleType): void {
        if (ALL_NOTES.includes(root) && scaleName in SCALES) {
            this.selectedRoot = root;
            this.selectedScaleName = scaleName;
            this.scaleNotes = this.calculateScaleNotes();
            console.log(`Scale set to ${root} ${scaleName}: ${this.scaleNotes.join(', ')}`);
        } else {
            console.error(`Invalid scale parameters. Root must be in ${ALL_NOTES} and scale in ${Object.keys(SCALES)}`);
        }
    }

    public getFretboardMap(numFrets: number = 12): Record<number, NoteType[]> {
        const fretboard: Record<number, NoteType[]> = {};
        
        OPEN_STRINGS.forEach((openNote, stringIdx) => {
            const stringNotes: NoteType[] = [];
            const openNoteIdx = ALL_NOTES.indexOf(openNote);
            
            for (let fret = 0; fret <= numFrets; fret++) {
                const noteIdx = (openNoteIdx + fret) % 12;
                stringNotes.push(ALL_NOTES[noteIdx]);
            }
            
            fretboard[stringIdx] = stringNotes;
        });
        
        return fretboard;
    }

    public isNoteInScale(note: NoteType): boolean {
        return this.scaleNotes.includes(note);
    }

    public getStringNotePositions(stringIdx: number, numFrets: number = 12): number[] {
        if (stringIdx < 0 || stringIdx >= OPEN_STRINGS.length) {
            return [];
        }
        
        const positions: number[] = [];
        const openNote = OPEN_STRINGS[stringIdx];
        const openNoteIdx = ALL_NOTES.indexOf(openNote);
        
        for (let fret = 0; fret <= numFrets; fret++) {
            const noteIdx = (openNoteIdx + fret) % 12;
            const note = ALL_NOTES[noteIdx];
            
            if (this.isNoteInScale(note)) {
                positions.push(fret);
            }
        }
        
        return positions;
    }

    public getNoteAtPosition(stringIdx: number, fretNum: number): NoteType {
        if (stringIdx < 0 || stringIdx >= OPEN_STRINGS.length) {
            return '' as NoteType;
        }
        
        const openNote = OPEN_STRINGS[stringIdx];
        const openNoteIdx = ALL_NOTES.indexOf(openNote);
        const noteIdx = (openNoteIdx + fretNum) % 12;
        return ALL_NOTES[noteIdx];
    }

    public getSelectedScale(): { root: NoteType; scaleName: ScaleType; notes: NoteType[] } {
        return {
            root: this.selectedRoot,
            scaleName: this.selectedScaleName,
            notes: this.scaleNotes
        };
    }
} 