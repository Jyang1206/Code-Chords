# Guitar Detection Pipeline Setup Guide

## Overview
This setup migrates your guitar fret detection from local processing to a React frontend that sends frames to your Flask backend for processing, then displays the annotated frames with scale notes.

## Quick Setup

### 1. Backend Setup (Flask)
```bash
cd backend-server

# Install dependencies
pip install -r requirements.txt

# Start the Flask server
python app.py
```

The server will run on `http://localhost:8000` with WebSocket support.

### 2. Frontend Setup (React)
```bash 
cd guitar-story

# Install new dependency
npm install socket.io-client

# Start the React dev server
npm run dev
```

The React app will run on `http://localhost:5173` (or similar Vite port).

## How It Works

### Pipeline Flow:
1. **React Frontend**: Captures webcam frames at 10 FPS
2. **WebSocket**: Sends frames as base64 to Flask backend
3. **Flask Backend**: 
   - Receives frames via WebSocket
   - Runs Roboflow inference on each frame
   - Processes with your existing `fretDetector.py` logic
   - Draws scale notes on detected frets
   - Returns annotated frame as base64
4. **React Frontend**: Displays processed frame with notes

### Key Features:
- **Real-time processing**: 10 FPS frame processing
- **Scale controls**: Change scales via React buttons
- **WebSocket communication**: Low-latency frame transfer
- **Same Python logic**: Uses your existing `custom_sink` and `draw_scale_notes`
- **Connection status**: Shows backend connection state

## API Endpoints

### WebSocket Events:
- `process_frame_ws`: Send frame for processing
- `frame_processed`: Receive processed frame
- `change_scale_ws`: Change musical scale
- `scale_changed`: Receive scale change confirmation

### HTTP Endpoints (still available):
- `POST /process_frame`: Process single frame via HTTP
- `POST /change_scale`: Change scale via HTTP
- `GET /get_frets`: Get current fret data
- `GET /health`: Health check

## Troubleshooting

### Common Issues:
1. **WebSocket connection fails**: Ensure Flask server is running on port 8000
2. **Frame processing errors**: Check Roboflow API key and model ID
3. **High latency**: Reduce frame rate in React (change `100` to `200` for 5 FPS)
4. **Memory issues**: Backend cleans up temp files automatically

### Performance Tips:
- Reduce frame quality in React: `canvas.toDataURL('image/jpeg', 0.7)`
- Increase frame interval: `setInterval(..., 200)` for 5 FPS
- Monitor backend CPU usage during processing

## Migration Benefits

✅ **Same Python Logic**: All your existing fret detection and note drawing logic is preserved
✅ **Better UI**: React provides better user experience with scale controls
✅ **Real-time**: WebSocket provides low-latency communication
✅ **Scalable**: Easy to add more features like calibration, recording, etc.
✅ **Cross-platform**: Works on any device with a webcam

## Next Steps

1. Test the basic pipeline
2. Add calibration overlay (if needed)
3. Optimize frame rate based on performance
4. Add error handling and retry logic
5. Consider adding frame buffering for smoother playback 