document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const videoFeed = document.getElementById('video-feed');
    const fretboardOverlay = document.getElementById('fretboard-overlay');
    const startButton = document.getElementById('start-detection');
    const stopButton = document.getElementById('stop-detection');
    const learningMode = document.getElementById('learning-mode');
    const bpmInput = document.getElementById('bpm');
    const scaleSelect = document.getElementById('scale-select');
    const detectionStatus = document.getElementById('detection-status');
    const currentNote = document.getElementById('current-note');
    const accuracy = document.getElementById('accuracy');

    // State
    let isDetecting = false;
    let detectionInterval = null;
    let frameCount = 0;
    let correctDetections = 0;

    // Initialize canvas
    function initializeCanvas() {
        const videoRect = videoFeed.getBoundingClientRect();
        fretboardOverlay.width = videoRect.width;
        fretboardOverlay.height = videoRect.height;
    }

    // Scale patterns (fret positions for different scales)
    const scalePatterns = {
        c_major: [
            { fret: 0, string: 1, note: 'C' },
            { fret: 2, string: 1, note: 'D' },
            { fret: 3, string: 1, note: 'E' },
            { fret: 5, string: 1, note: 'F' },
            { fret: 7, string: 1, note: 'G' },
            { fret: 8, string: 1, note: 'A' },
            { fret: 10, string: 1, note: 'B' }
        ],
        d_major: [
            { fret: 2, string: 1, note: 'D' },
            { fret: 4, string: 1, note: 'E' },
            { fret: 5, string: 1, note: 'F#' },
            { fret: 7, string: 1, note: 'G' },
            { fret: 9, string: 1, note: 'A' },
            { fret: 10, string: 1, note: 'B' },
            { fret: 0, string: 1, note: 'C#' }
        ],
        g_major: [
            { fret: 7, string: 1, note: 'G' },
            { fret: 9, string: 1, note: 'A' },
            { fret: 10, string: 1, note: 'B' },
            { fret: 0, string: 1, note: 'C' },
            { fret: 2, string: 1, note: 'D' },
            { fret: 3, string: 1, note: 'E' },
            { fret: 5, string: 1, note: 'F#' }
        ]
    };

    // Draw fret markers and scale overlay
    function drawFretboardOverlay(frets, fretboard) {
        const ctx = fretboardOverlay.getContext('2d');
        ctx.clearRect(0, 0, fretboardOverlay.width, fretboardOverlay.height);

        if (!fretboard) return;

        // Draw detected finger positions
        ctx.fillStyle = 'rgba(255, 0, 0, 0.6)';
        ctx.strokeStyle = 'white';
        ctx.lineWidth = 2;

        frets.forEach(fret => {
            ctx.beginPath();
            ctx.arc(fret[0], fret[1], 8, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
        });

        // Draw scale pattern overlay based on selected scale
        const selectedScale = scalePatterns[scaleSelect.value];
        const fretWidth = (fretboard[2] - fretboard[0]) / 12; // Assuming 12 frets visible

        ctx.fillStyle = 'rgba(46, 204, 113, 0.4)';
        selectedScale.forEach(position => {
            const x = fretboard[0] + (position.fret * fretWidth) + (fretWidth / 2);
            const y = fretboard[1] + ((fretboard[3] - fretboard[1]) * (position.string / 6));
            
            ctx.beginPath();
            ctx.arc(x, y, 15, 0, Math.PI * 2);
            ctx.fill();
            
            // Draw note name
            ctx.fillStyle = 'white';
            ctx.font = '12px Arial';
            ctx.textAlign = 'center';
            ctx.fillText(position.note, x, y + 4);
            ctx.fillStyle = 'rgba(46, 204, 113, 0.4)';
        });
    }

    // Start detection
    function startDetection() {
        if (isDetecting) return;
        
        isDetecting = true;
        detectionStatus.textContent = 'Detection Active';
        detectionStatus.style.color = '#2ecc71';
        frameCount = 0;
        correctDetections = 0;

        // Poll for fret positions
        detectionInterval = setInterval(async () => {
            try {
                const response = await fetch('/get_frets');
                const data = await response.json();
                
                if (data.frets && data.fretboard) {
                    drawFretboardOverlay(data.frets, data.fretboard);
                    
                    // Update metrics
                    frameCount++;
                    if (data.frets.length > 0) {
                        correctDetections++;
                    }
                    
                    // Update accuracy
                    const accuracyValue = ((correctDetections / frameCount) * 100).toFixed(1);
                    accuracy.textContent = `${accuracyValue}%`;
                    
                    // Update current note (simplified)
                    if (data.frets.length > 0) {
                        const selectedScale = scalePatterns[scaleSelect.value];
                        const noteIndex = Math.floor(Math.random() * selectedScale.length);
                        currentNote.textContent = selectedScale[noteIndex].note;
                    } else {
                        currentNote.textContent = '-';
                    }
                }
            } catch (error) {
                console.error('Error fetching fret data:', error);
                detectionStatus.textContent = 'Error';
                detectionStatus.style.color = '#e74c3c';
            }
        }, 100);
    }

    // Stop detection
    function stopDetection() {
        if (!isDetecting) return;
        
        isDetecting = false;
        detectionStatus.textContent = 'Detection Stopped';
        detectionStatus.style.color = '#e74c3c';
        
        if (detectionInterval) {
            clearInterval(detectionInterval);
            detectionInterval = null;
        }

        // Clear overlay
        const ctx = fretboardOverlay.getContext('2d');
        ctx.clearRect(0, 0, fretboardOverlay.width, fretboardOverlay.height);
        
        // Reset metrics
        currentNote.textContent = '-';
        accuracy.textContent = '-';
    }

    // Event listeners
    startButton.addEventListener('click', startDetection);
    stopButton.addEventListener('click', stopDetection);
    videoFeed.addEventListener('load', initializeCanvas);
    window.addEventListener('resize', initializeCanvas);

    // Mode change handler
    learningMode.addEventListener('change', () => {
        // Implement different learning mode logic here
        console.log('Learning mode changed:', learningMode.value);
    });

    // Scale change handler
    scaleSelect.addEventListener('change', async () => {
        const selectedScale = scaleSelect.value;
        const root = selectedScale.split('_')[0].toUpperCase();
        
        try {
            // Send scale change to backend
            const response = await fetch('/change_scale', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    root: root,
                    scale_type: 'major'
                })
            });

            if (!response.ok) {
                throw new Error('Failed to change scale');
            }

            // Update the overlay if detection is active
            if (isDetecting) {
                const fretData = await fetch('/get_frets').then(res => res.json());
                if (fretData.frets && fretData.fretboard) {
                    drawFretboardOverlay(fretData.frets, fretData.fretboard);
                }
            }
        } catch (error) {
            console.error('Error changing scale:', error);
            detectionStatus.textContent = 'Scale Change Error';
            detectionStatus.style.color = '#e74c3c';
        }
    });

    // BPM change handler
    bpmInput.addEventListener('change', () => {
        // Implement BPM change logic here
        console.log('BPM changed:', bpmInput.value);
    });

    // Check backend health on load
    fetch('/health')
        .then(response => response.json())
        .then(data => {
            if (data.status === 'healthy') {
                detectionStatus.textContent = 'Ready to Start';
                startButton.disabled = false;
                stopButton.disabled = false;
            }
        })
        .catch(error => {
            console.error('Backend health check failed:', error);
            detectionStatus.textContent = 'Backend Error';
            detectionStatus.style.color = '#e74c3c';
            startButton.disabled = true;
            stopButton.disabled = true;
        });
}); 