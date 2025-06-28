#!/usr/bin/env python3
"""
Test script for MJPEG streaming functionality
"""

import requests
import time
import cv2
import numpy as np

def test_mjpeg_stream():
    """Test the MJPEG streaming endpoint."""
    base_url = "http://localhost:8000"
    
    print("Testing MJPEG streaming...")
    
    # Test health endpoint
    try:
        response = requests.get(f"{base_url}/health")
        if response.status_code == 200:
            print("✓ Backend is healthy")
        else:
            print("✗ Backend health check failed")
            return False
    except Exception as e:
        print(f"✗ Cannot connect to backend: {e}")
        return False
    
    # Test start stream endpoint
    try:
        response = requests.get(f"{base_url}/start_stream")
        if response.status_code == 200:
            print("✓ Stream started successfully")
        else:
            print("✗ Failed to start stream")
            return False
    except Exception as e:
        print(f"✗ Error starting stream: {e}")
        return False
    
    # Test MJPEG stream endpoint
    try:
        print("Connecting to MJPEG stream...")
        response = requests.get(f"{base_url}/mjpeg_stream", stream=True)
        
        if response.status_code == 200:
            print("✓ MJPEG stream connected")
            
            # Read a few frames to test
            frame_count = 0
            start_time = time.time()
            
            for chunk in response.iter_content(chunk_size=1024):
                if b'--frame' in chunk:
                    frame_count += 1
                    if frame_count >= 5:  # Test 5 frames
                        break
                    print(f"  Received frame {frame_count}")
            
            elapsed_time = time.time() - start_time
            print(f"✓ Received {frame_count} frames in {elapsed_time:.2f} seconds")
            
        else:
            print(f"✗ MJPEG stream failed with status {response.status_code}")
            return False
            
    except Exception as e:
        print(f"✗ Error connecting to MJPEG stream: {e}")
        return False
    
    # Test stop stream endpoint
    try:
        response = requests.get(f"{base_url}/stop_stream")
        if response.status_code == 200:
            print("✓ Stream stopped successfully")
        else:
            print("✗ Failed to stop stream")
            return False
    except Exception as e:
        print(f"✗ Error stopping stream: {e}")
        return False
    
    print("\n🎉 All MJPEG streaming tests passed!")
    return True

def test_scale_change():
    """Test scale change functionality."""
    base_url = "http://localhost:8000"
    
    print("\nTesting scale change functionality...")
    
    try:
        response = requests.post(f"{base_url}/change_scale", 
                               json={"root": "G", "scale_type": "major"})
        if response.status_code == 200:
            data = response.json()
            print(f"✓ Scale changed to {data.get('message', 'unknown')}")
        else:
            print("✗ Failed to change scale")
            return False
    except Exception as e:
        print(f"✗ Error changing scale: {e}")
        return False
    
    print("✓ Scale change test passed!")
    return True

if __name__ == "__main__":
    print("Starting MJPEG streaming tests...\n")
    
    success = True
    success &= test_mjpeg_stream()
    success &= test_scale_change()
    
    if success:
        print("\n🎉 All tests passed! MJPEG streaming is working correctly.")
    else:
        print("\n❌ Some tests failed. Please check the backend server.") 