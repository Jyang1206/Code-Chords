interface FretData {
    x_center: number;
    y_center: number;
    y_min: number;
    y_max: number;
    width: number;
    fret_num: number;
    confidence: number;
}

interface Detection {
    class: string;
    confidence: number;
    points: Array<{ x: number; y: number }>;
}

export class FretTracker {
    private frets: Record<number, FretData>;
    private fretHistory: Record<number, FretData[]>;
    private confidenceHistory: Record<number, number[]>;
    private readonly historyMaxSize: number;
    private readonly numFrets: number;
    private readonly stabilityThreshold: number;
    private lastUpdateTime: number;
    private readonly updateInterval: number;
    private sortedFrets: [number, FretData][];
    private frameHeight: number;
    private readonly debugMode: boolean;
    private readonly minFretWidth: number;
    private readonly minFretSpacing: number;
    private readonly maxFretSpacing: number;

    constructor(numFrets = 12, stabilityThreshold = 0.3) {
        this.frets = {};
        this.fretHistory = {};
        this.confidenceHistory = {};
        this.historyMaxSize = 45;
        this.numFrets = numFrets;
        this.stabilityThreshold = stabilityThreshold;
        this.lastUpdateTime = Date.now();
        this.updateInterval = 33; // 30fps
        this.sortedFrets = [];
        this.frameHeight = 0;
        this.debugMode = true;
        this.minFretWidth = 20;
        this.minFretSpacing = 40;
        this.maxFretSpacing = 120;
    }

    public update(detections: Detection[], frameHeight: number): void {
        this.frameHeight = frameHeight;
        const currentTime = Date.now();
        
        if (currentTime - this.lastUpdateTime < this.updateInterval) {
            return;
        }
        
        this.lastUpdateTime = currentTime;
        const currentFrets: Record<number, FretData> = {};
        
        // First pass: collect all detections
        for (const det of detections) {
            if (!det.points) continue;
            
            const className = det.class;
            if (className === "Hand" || !className.startsWith("Zone")) continue;
            
            // Get fret number
            let fretNum: number;
            try {
                fretNum = parseInt(className.slice(4)); // Extract number after "Zone"
            } catch {
                continue;
            }
            
            if (fretNum < 1 || fretNum > this.numFrets) continue;
            
            // Check confidence threshold
            const confidence = det.confidence;
            if (confidence < this.stabilityThreshold) continue;
            
            const polygon = det.points.map(pt => [pt.x, pt.y]);
            if (polygon.length < 3) continue;
            
            const xCoords = polygon.map(pt => pt[0]);
            const yCoords = polygon.map(pt => pt[1]);
            const xCenter = Math.round(xCoords.reduce((a, b) => a + b) / xCoords.length);
            const yCenter = Math.round(yCoords.reduce((a, b) => a + b) / yCoords.length);
            
            // Basic width validation
            const fretWidth = Math.max(...xCoords) - Math.min(...xCoords);
            if (fretWidth < this.minFretWidth) continue;
            
            // Store basic fret data
            currentFrets[xCenter] = {
                x_center: xCenter,
                y_center: yCenter,
                y_min: Math.min(...yCoords),
                y_max: Math.max(...yCoords),
                width: fretWidth,
                fret_num: fretNum,
                confidence: confidence
            };
        }
        
        // Second pass: validate spacing between frets
        const sortedFrets = Object.entries(currentFrets)
            .map(([x, data]) => [parseInt(x), data] as [number, FretData])
            .sort((a, b) => a[1].x_center - b[1].x_center);
        
        const validFrets: Record<number, FretData> = {};
        
        for (let i = 0; i < sortedFrets.length; i++) {
            const [xCenter, fretData] = sortedFrets[i];
            let isValid = true;
            
            // Check spacing with previous fret
            if (i > 0) {
                const prevX = sortedFrets[i-1][1].x_center;
                const spacing = xCenter - prevX;
                if (spacing < this.minFretSpacing || spacing > this.maxFretSpacing) {
                    isValid = false;
                }
            }
            
            if (isValid) {
                validFrets[xCenter] = fretData;
            }
        }
        
        this.frets = validFrets;
        this.sortedFrets = Object.entries(validFrets)
            .map(([x, data]) => [parseInt(x), data] as [number, FretData])
            .sort((a, b) => a[1].x_center - b[1].x_center);
    }

    public getStringPositions(fretData: FretData): number[] {
        const yMin = fretData.y_min;
        const yMax = fretData.y_max;
        const totalHeight = yMax - yMin;
        
        // Calculate 6 evenly spaced string positions
        return Array.from({ length: 6 }, (_, i) => 
            Math.round(yMin + (i * totalHeight / 5))
        );
    }

    public getStableFrets(): Record<number, FretData> {
        return this.frets;
    }

    public getSortedFrets(): [number, FretData][] {
        return this.sortedFrets;
    }
} 