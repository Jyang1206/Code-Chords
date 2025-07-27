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

# Install dependency
npm install 

# Start the React dev server
npm run dev
```

The React app will run on `http://localhost:5173` (or similar Vite port).

## How It Works

### Key Features:
- **Real-time processing**: 10 FPS frame processing
- **Scale controls**: Change scales via React buttons
- **WebSocket communication**: Low-latency frame transfer
- **Connection status**: Shows backend connection state