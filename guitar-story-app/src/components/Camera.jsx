import React, { useEffect, useRef, useState } from 'react';
import { FretboardNotes } from '../utils/fretboardNotes';
import { FretTracker } from '../utils/fretTracker';

export const Camera = ({ apiKey, modelId, onScaleChange }) => {
    const videoRef = useRef(null);
    const canvasRef = useRef(null);
    const [isCameraActive, setIsCameraActive] = useState(false);
    const [error, setError] = useState(null);
    const [confidence, setConfidence] = useState(0.3);
    
    // Initialize our tracking objects
    const fretboardNotes = useRef(new FretboardNotes());
    const fretTracker = useRef(new FretTracker(12, confidence));
    
    // Initialize Roboflow
    useEffect(() => {
        const initRoboflow = async () => {
            try {
                const roboflow = await import('@roboflow/inference');
                const model = await roboflow.auth({
                    publishable_key: apiKey
                }).load({
                    model: modelId,
                    version: 1
                });
                
                // Store model in ref for use in detection loop
                modelRef.current = model;
            } catch (err) {
                setError('Failed to initialize Roboflow model');
                console.error(err);
            }
        };
        
        initRoboflow();
    }, [apiKey, modelId]);
    
    const modelRef = useRef(null);
    
    // Camera setup
    const setupCamera = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    facingMode: 'user',
                    width: { ideal: 1280 },
                    height: { ideal: 720 }
                }
            });
            
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                await videoRef.current.play();
                
                if (canvasRef.current) {
                    canvasRef.current.width = videoRef.current.videoWidth;
                    canvasRef.current.height = videoRef.current.videoHeight;
                }
                
                setIsCameraActive(true);
                startDetection();
            }
        } catch (err) {
            setError('Failed to access camera');
            console.error(err);
        }
    };
    
    // Detection loop
    const startDetection = () => {
        if (!videoRef.current || !canvasRef.current || !modelRef.current) return;
        
        const detectFrame = async () => {
            if (!isCameraActive) return;
            
            try {
                // Get video frame
                const video = videoRef.current;
                const canvas = canvasRef.current;
                const ctx = canvas.getContext('2d');
                
                // Draw video frame
                ctx.save();
                ctx.translate(canvas.width, 0);
                ctx.scale(-1, 1);
                ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                ctx.restore();
                
                // Create a snapshot for detection
                const snapCanvas = document.createElement('canvas');
                const snapCtx = snapCanvas.getContext('2d');
                snapCanvas.width = 416;
                snapCanvas.height = 416;
                
                // Calculate aspect ratio preserving dimensions
                const videoRatio = video.videoWidth / video.videoHeight;
                let drawWidth, drawHeight, offsetX = 0, offsetY = 0;
                
                if (videoRatio > 1) {
                    drawHeight = snapCanvas.height;
                    drawWidth = drawHeight * videoRatio;
                    offsetX = (snapCanvas.width - drawWidth) / 2;
                } else {
                    drawWidth = snapCanvas.width;
                    drawHeight = drawWidth / videoRatio;
                    offsetY = (snapCanvas.height - drawHeight) / 2;
                }
                
                // Draw video frame to snapshot canvas
                snapCtx.fillStyle = 'black';
                snapCtx.fillRect(0, 0, snapCanvas.width, snapCanvas.height);
                snapCtx.drawImage(video, offsetX, offsetY, drawWidth, drawHeight);
                
                // Convert to blob for detection
                const blob = await new Promise((resolve) => {
                    snapCanvas.toBlob((blob) => {
                        if (blob) resolve(blob);
                    }, 'image/jpeg', 0.85);
                });
                
                // Run detection
                const predictions = await modelRef.current.detect(blob);
                
                // Update fret tracking
                fretTracker.current.update(predictions, canvas.height);
                
                // Draw scale notes
                drawScaleNotes(ctx, fretTracker.current, fretboardNotes.current);
                
                // Notify scale changes
                if (onScaleChange) {
                    onScaleChange(fretboardNotes.current.getSelectedScale());
                }
                
            } catch (err) {
                console.error('Error in detection loop:', err);
            }
            
            // Continue detection loop
            requestAnimationFrame(detectFrame);
        };
        
        detectFrame();
    };
    
    // Draw scale notes on canvas
    const drawScaleNotes = (ctx, fretTracker, fretboardNotes) => {
        const stableFrets = fretTracker.getStableFrets();
        
        // Draw scale information
        const scale = fretboardNotes.getSelectedScale();
        ctx.font = '18px Arial';
        ctx.fillStyle = 'yellow';
        ctx.fillText(`Scale: ${scale.root} ${scale.scaleName}`, 10, 30);
        ctx.fillText(`Notes: ${scale.notes.join(', ')}`, 10, 60);
        
        // Process frets in order
        for (const [xCenter, fretData] of fretTracker.getSortedFrets()) {
            const fretNum = fretData.fret_num;
            if (fretNum < 1) continue;
            
            // Draw fret number
            ctx.fillStyle = 'white';
            ctx.fillText(
                `Fret ${fretNum}`,
                fretData.x_center - 20,
                fretData.y_min - 10
            );
            
            // Get string positions
            const stringPositions = fretTracker.getStringPositions(fretData);
            
            // Draw dots for each string
            for (let stringIdx = 0; stringIdx < stringPositions.length; stringIdx++) {
                const yPos = stringPositions[stringIdx];
                const scalePositions = fretboardNotes.getStringNotePositions(stringIdx);
                const noteName = fretboardNotes.getNoteAtPosition(stringIdx, fretNum);
                
                if (fretNum in scalePositions) {
                    if (noteName === scale.root) {
                        // Root note - red
                        ctx.beginPath();
                        ctx.arc(fretData.x_center, yPos, 8, 0, Math.PI * 2);
                        ctx.fillStyle = 'red';
                        ctx.fill();
                        ctx.strokeStyle = 'white';
                        ctx.stroke();
                        
                        // Add note name
                        ctx.fillStyle = 'red';
                        ctx.fillText(noteName, fretData.x_center + 10, yPos + 4);
                    } else {
                        // Scale note - blue
                        ctx.beginPath();
                        ctx.arc(fretData.x_center, yPos, 6, 0, Math.PI * 2);
                        ctx.fillStyle = 'blue';
                        ctx.fill();
                        ctx.strokeStyle = 'white';
                        ctx.stroke();
                        
                        // Add note name
                        ctx.fillStyle = 'white';
                        ctx.fillText(noteName, fretData.x_center + 10, yPos + 4);
                    }
                } else {
                    // Note not in scale - grey
                    ctx.beginPath();
                    ctx.arc(fretData.x_center, yPos, 4, 0, Math.PI * 2);
                    ctx.fillStyle = 'grey';
                    ctx.fill();
                }
            }
        }
    };
    
    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (videoRef.current?.srcObject) {
                const stream = videoRef.current.srcObject;
                stream.getTracks().forEach(track => track.stop());
            }
            setIsCameraActive(false);
        };
    }, []);
    
    return (
        <div className="camera-container">
            {error && <div className="error-message">{error}</div>}
            <video
                ref={videoRef}
                style={{ display: 'none' }}
                playsInline
                muted
            />
            <canvas
                ref={canvasRef}
                style={{
                    width: '100%',
                    maxWidth: '800px',
                    height: 'auto'
                }}
            />
            <div className="controls">
                <button
                    onClick={() => {
                        if (isCameraActive) {
                            setIsCameraActive(false);
                            if (videoRef.current?.srcObject) {
                                const stream = videoRef.current.srcObject;
                                stream.getTracks().forEach(track => track.stop());
                            }
                        } else {
                            setupCamera();
                        }
                    }}
                >
                    {isCameraActive ? 'Stop Camera' : 'Start Camera'}
                </button>
                <div className="scale-controls">
                    <button onClick={() => fretboardNotes.current.setScale('C', 'major')}>C Major</button>
                    <button onClick={() => fretboardNotes.current.setScale('A', 'minor')}>A Minor</button>
                    <button onClick={() => fretboardNotes.current.setScale('G', 'major')}>G Major</button>
                    <button onClick={() => fretboardNotes.current.setScale('E', 'minor')}>E Minor</button>
                    <button onClick={() => fretboardNotes.current.setScale('F', 'major')}>F Major</button>
                    <button onClick={() => fretboardNotes.current.setScale('D', 'major')}>D Major</button>
                </div>
            </div>
        </div>
    );
}; 