# Guitar Fretboard Detector - Client-side Version

This is a web-based guitar fretboard detector that uses the Roboflow InferenceJS library to perform client-side inference directly in your browser. This eliminates the need for a backend server and improves performance by avoiding API calls.

## Features

- Real-time guitar fretboard detection using your webcam
- Client-side inference with InferenceJS
- Display of scale notes directly on the detected fretboard
- Support for multiple scales (major, minor, pentatonic, blues)
- Customizable number of frets (1-24)
- Debug visualization mode
- Screenshot functionality

## How to Use

1. Open `inference-client.html` in a modern web browser (Chrome, Firefox, Edge recommended)
2. Click "Start Camera" to activate your webcam
3. Point your camera at a guitar fretboard
4. The app will detect the frets and display scale notes on the fretboard
5. Use the scale buttons to change between different scales
6. Adjust the number of frets using the slider if needed
7. Toggle debug mode to see additional detection information
8. Take screenshots with the "Take Screenshot" button

## Requirements

- Modern web browser with JavaScript enabled
- Webcam or camera
- Internet connection (for loading the InferenceJS library and model)

## Technical Details

This application uses:
- Roboflow InferenceJS for client-side object detection
- HTML5 Canvas for visualization
- The same guitar-frets-segmenter model as the server version
- JavaScript implementation of musical scales and fretboard notes

## Advantages Over Server Version

- No need to run a Python backend server
- Reduced latency (no network requests for each frame)
- Works offline after initial model loading
- Can be deployed as a static website
- More privacy-friendly (video never leaves your device)

## Troubleshooting

- If the camera doesn't start, make sure you've granted camera permissions to the website
- If detections are slow, try using a device with better GPU capabilities
- For mobile devices, use landscape orientation for better results 