# MJPEG Streaming Implementation

This document describes the MJPEG streaming implementation for real-time guitar fret detection and note visualization.

## Overview

The MJPEG streaming system provides smooth, real-time video streaming from the backend to the React frontend, with integrated fret detection and scale note visualization.

## Architecture

### Backend Components

1. **InferencePipeline** (`inference.py`)
   - Handles fret detection using computer vision techniques
   - Uses Hough line transform for fret detection
   - Optimized for performance with frame caching
   - Runs at 10 FPS for detection, 30 FPS for streaming

2. **MJPEG Streaming** (`app.py`)
   - `/mjpeg_stream` - Main MJPEG streaming endpoint
   - `/start_stream` - Start the webcam stream
   - `/stop_stream` - Stop the webcam stream
   - `/change_scale` - Change musical scale for note visualization

3. **Fret Detection** (`fretDetector.py`)
   - FretTracker for stable fret position tracking
   - FretboardNotes for scale calculation and note mapping
   - Custom sink function for drawing notes on frames

### Frontend Components

1. **MJPEGStream** (`MJPEGStream.jsx`)
   - React component for displaying MJPEG stream
   - Scale control interface
   - Real-time status monitoring
   - Responsive design for mobile and desktop

## Features

### Real-time Streaming
- 30 FPS MJPEG streaming from webcam
- Optimized JPEG encoding for smooth playback
- Automatic frame rate control
- Error handling and recovery

### Fret Detection
- Computer vision-based fret detection using Hough line transform
- Stable tracking with position smoothing
- Confidence-based filtering
- Automatic fret numbering

### Scale Visualization
- Real-time scale note highlighting
- Support for multiple scale types:
  - Major, Minor, Pentatonic Major/Minor, Blues
  - All root notes (C, D, E, F, G, A, B)
- Dynamic scale changing via frontend controls

### Performance Optimizations
- Frame caching to reduce processing overhead
- Optimized Hough line detection parameters
- Efficient JPEG encoding with quality settings
- Frame hash checking for change detection

## Usage

### Starting the Backend

```bash
cd backend-server
python app.py
```

The server will start on `http://localhost:8000`

### Starting the Frontend

```bash
cd guitar-story
npm run dev
```

The React app will start on `http://localhost:5173`

### Using the MJPEG Stream

1. Navigate to the Practice page in the React app
2. Click "Start Stream" to begin MJPEG streaming
3. The webcam will activate and start detecting frets
4. Use the scale controls to change musical scales
5. Notes in the selected scale will be highlighted on the fretboard
6. Click "Stop Stream" to end the session

## API Endpoints

### MJPEG Streaming
- `GET /mjpeg_stream` - MJPEG video stream
- `GET /start_stream` - Start webcam stream
- `GET /stop_stream` - Stop webcam stream

### Scale Control
- `POST /change_scale` - Change musical scale
  ```json
  {
    "root": "C",
    "scale_type": "major"
  }
  ```

### Health Check
- `GET /health` - Server health status

## Technical Details

### MJPEG Format
The backend streams frames in MJPEG format:
```
--frame
Content-Type: image/jpeg
Content-Length: [size]

[frame data]
--frame
...
```

### Frame Processing Pipeline
1. Capture frame from webcam
2. Run InferencePipeline for fret detection
3. Apply FretTracker for position stabilization
4. Draw scale notes using FretboardNotes
5. Encode as JPEG with optimized settings
6. Stream via MJPEG format

### Performance Characteristics
- **Detection Rate**: 10 FPS (every 100ms)
- **Streaming Rate**: 30 FPS (every 33ms)
- **Latency**: ~100ms end-to-end
- **Resolution**: 1280x720 (configurable)
- **JPEG Quality**: 85% (optimized for quality/size)

## Troubleshooting

### Common Issues

1. **Webcam not found**
   - Ensure webcam is connected and not in use by other applications
   - Check webcam permissions in browser

2. **Stream not starting**
   - Verify backend server is running on port 8000
   - Check webcam initialization in backend logs

3. **Poor performance**
   - Reduce webcam resolution in `init_webcam()`
   - Increase detection interval in InferencePipeline
   - Lower JPEG quality settings

4. **Fret detection issues**
   - Ensure good lighting conditions
   - Position guitar neck clearly in frame
   - Adjust Hough line parameters in inference.py

### Testing

Run the test script to verify functionality:
```bash
python test_mjpeg.py
```

## Future Enhancements

1. **ML-based Detection**: Replace computer vision with trained ML models
2. **Multi-camera Support**: Support for multiple camera inputs
3. **Advanced Filtering**: Better noise reduction and edge detection
4. **Calibration System**: User-guided fret calibration
5. **Recording**: Save processed streams for later analysis 