# Guitar Detection Backend

This is the Python backend for the guitar learning assistant app that processes video frames from the React frontend and returns processed frames with fret detection and scale notes drawn on them.

## Features

- Real-time guitar fret detection using Roboflow AI
- Scale note visualization on detected frets
- WebSocket communication with React frontend
- Support for multiple scales (major, minor, pentatonic, blues, etc.)
- Calibration system for improved accuracy
- Frame processing with OpenCV

## Setup

1. Install Python dependencies:
```bash
pip install -r requirements.txt
```

2. Set up environment variables (optional):
```bash
# Create a .env file with:
API_KEY=your_roboflow_api_key
MODEL_ID=guitar-frets-segmenter/1
FLASK_PORT=8000
```

3. Run the backend server:
```bash
python app.py
```

The server will start on `http://localhost:8000` with WebSocket support.

## API Endpoints

- `GET /` - Main page
- `GET /video_feed` - Video stream (legacy)
- `GET /get_frets` - Get current fret data
- `POST /change_scale` - Change the current scale
- `POST /update_confidence` - Update detection confidence threshold
- `POST /api/calibrate` - Update calibration data
- `POST /process_frame` - Process a single frame

## WebSocket Events

- `frame` - Receive video frame from frontend
- `processed_frame` - Send processed frame back to frontend
- `calibration_update` - Update calibration data
- `calibration_ack` - Acknowledge calibration update

## Integration with React Frontend

The backend communicates with the React frontend via WebSocket. The frontend sends video frames as base64-encoded JPEG images, and the backend returns processed frames with fret detection and scale notes drawn on them.

## Dependencies

- Flask with Socket.IO support
- OpenCV for image processing
- Roboflow inference SDK for AI detection
- NumPy for numerical operations
- MediaPipe for additional processing capabilities

## Troubleshooting

- Ensure all dependencies are installed correctly
- Check that the Roboflow API key is valid
- Verify WebSocket connections are working
- Monitor logs for any processing errors 