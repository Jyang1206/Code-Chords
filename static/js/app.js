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
    const loadingOverlay = document.getElementById('loading-overlay');

    // State
    let isDetecting = false;
    let detectionInterval = null;
    let frameCount = 0;
    let correctDetections = 0;
    let isVideoLoaded = false;
    let initializationTimeout = null;

    // Initialize canvas
    function initializeCanvas() {
        if (!videoFeed.complete) return;
        const videoRect = videoFeed.getBoundingClientRect();
        fretboardOverlay.width = videoRect.width;
        fretboardOverlay.height = videoRect.height;
    }

    // Handle video feed loading
    function handleVideoLoad() {
        console.log('Video feed loaded');
        isVideoLoaded = true;
        videoFeed.classList.add('loaded');
        initializeCanvas();
        detectionStatus.textContent = 'Camera Ready';
        detectionStatus.style.color = '#27ae60';
        startButton.disabled = false;
        loadingOverlay.style.display = 'none';
        
        // Clear any pending timeout
        if (initializationTimeout) {
            clearTimeout(initializationTimeout);
            initializationTimeout = null;
        }
    }

    function handleVideoError() {
        console.error('Video feed failed to load');
        detectionStatus.textContent = 'Camera Error';
        detectionStatus.style.color = '#e74c3c';
        startButton.disabled = true;
        loadingOverlay.style.display = 'none';
        
        // Clear any pending timeout
        if (initializationTimeout) {
            clearTimeout(initializationTimeout);
            initializationTimeout = null;
        }
    }

    // Set a timeout to handle initialization failures
    initializationTimeout = setTimeout(() => {
        if (!isVideoLoaded) {
            console.log('Initialization timeout - reloading video feed');
            videoFeed.src = videoFeed.src + '?' + new Date().getTime(); // Force reload
        }
    }, 5000); // 5 second timeout

    // Initialize video feed
    videoFeed.addEventListener('load', handleVideoLoad);
    videoFeed.addEventListener('error', handleVideoError);
    
    // If the video is already loaded (cached), trigger load handler
    if (videoFeed.complete) {
        handleVideoLoad();
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
        a_minor: [
            { fret: 0, string: 1, note: 'A' },
            { fret: 2, string: 1, note: 'B' },
            { fret: 3, string: 1, note: 'C' },
            { fret: 5, string: 1, note: 'D' },
            { fret: 7, string: 1, note: 'E' },
            { fret: 8, string: 1, note: 'F' },
            { fret: 10, string: 1, note: 'G' }
        ],
        g_major: [
            { fret: 7, string: 1, note: 'G' },
            { fret: 9, string: 1, note: 'A' },
            { fret: 10, string: 1, note: 'B' },
            { fret: 0, string: 1, note: 'C' },
            { fret: 2, string: 1, note: 'D' },
            { fret: 3, string: 1, note: 'E' },
            { fret: 5, string: 1, note: 'F#' }
        ],
        e_minor: [
            { fret: 0, string: 1, note: 'E' },
            { fret: 2, string: 1, note: 'F#' },
            { fret: 3, string: 1, note: 'G' },
            { fret: 5, string: 1, note: 'A' },
            { fret: 7, string: 1, note: 'B' },
            { fret: 8, string: 1, note: 'C' },
            { fret: 10, string: 1, note: 'D' }
        ],
        f_major: [
            { fret: 5, string: 1, note: 'F' },
            { fret: 7, string: 1, note: 'G' },
            { fret: 8, string: 1, note: 'A' },
            { fret: 10, string: 1, note: 'Bb' },
            { fret: 0, string: 1, note: 'C' },
            { fret: 1, string: 1, note: 'D' },
            { fret: 3, string: 1, note: 'E' }
        ],
        d_major: [
            { fret: 2, string: 1, note: 'D' },
            { fret: 4, string: 1, note: 'E' },
            { fret: 5, string: 1, note: 'F#' },
            { fret: 7, string: 1, note: 'G' },
            { fret: 9, string: 1, note: 'A' },
            { fret: 10, string: 1, note: 'B' },
            { fret: 0, string: 1, note: 'C#' }
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
        if (!isVideoLoaded) {
            console.warn('Video feed not ready');
            return;
        }

        if (isDetecting) return;
        
        isDetecting = true;
        detectionStatus.textContent = 'Detection Active';
        detectionStatus.style.color = '#27ae60';
        
        // Reset metrics
        frameCount = 0;
        correctDetections = 0;
        
        // Start detection loop
        detectionInterval = setInterval(() => {
            if (!isDetecting) return;
            
            // Get current fret data
            fetch('/get_frets')
                .then(response => response.json())
                .then(data => {
                    if (data.status === 'success') {
                        updateOverlay(data.frets);
                        frameCount++;
                        if (data.frets && data.frets.length > 0) {
                            correctDetections++;
                        }
                        // Update accuracy
                        const accuracyValue = frameCount > 0 ? 
                            Math.round((correctDetections / frameCount) * 100) : 0;
                        accuracy.textContent = `${accuracyValue}%`;
                    }
                })
                .catch(error => {
                    console.error('Error fetching fret data:', error);
                });
        }, 1000 / 30); // 30 FPS
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
    window.addEventListener('resize', initializeCanvas);

    // Disable start button initially
    startButton.disabled = true;
    detectionStatus.textContent = 'Initializing Camera...';
    detectionStatus.style.color = '#f39c12';

    // Mode change handler
    learningMode.addEventListener('change', () => {
        // Implement different learning mode logic here
        console.log('Learning mode changed:', learningMode.value);
    });

    // Scale change handler
    scaleSelect.addEventListener('change', async () => {
        const selectedScale = scaleSelect.value;
        const [root, scaleType] = selectedScale.split('_');
        
        try {
            // Send scale change to backend
            const response = await fetch('/change_scale', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    root: root.toUpperCase(),
                    scale_type: scaleType
                })
            });

            if (!response.ok) {
                throw new Error('Failed to change scale');
            }

            // Update the overlay if detection is active
            if (isDetecting) {
                const fretData = await fetch('/get_frets').then(res => res.json());
                if (fretData.status === 'success') {
                    updateOverlay(fretData.frets);
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

    // Modify the health check to be more robust
    async function checkBackendHealth() {
        try {
            const response = await fetch('/health');
            const data = await response.json();
            
            if (data.status === 'healthy') {
                detectionStatus.textContent = 'Ready to Start';
                startButton.disabled = false;
                stopButton.disabled = false;
                return true;
            }
            throw new Error('Backend not healthy');
        } catch (error) {
            console.error('Backend health check failed:', error);
            detectionStatus.textContent = 'Backend Error';
            detectionStatus.style.color = '#e74c3c';
            startButton.disabled = true;
            stopButton.disabled = true;
            return false;
        }
    }

    // Initial health check with retry
    async function initializeBackend() {
        let retries = 3;
        while (retries > 0) {
            if (await checkBackendHealth()) {
                return true;
            }
            retries--;
            if (retries > 0) {
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }
        return false;
    }

    // Start the initialization process
    initializeBackend().catch(error => {
        console.error('Failed to initialize backend:', error);
        handleVideoError();
    });
}); 