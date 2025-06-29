#!/usr/bin/env python3
"""
Performance test script to measure round-trip time from frontend to backend.
This simulates what your React frontend would do.
"""

import requests
import time
import cv2
import numpy as np
import base64
import json

def test_http_performance():
    """Test HTTP endpoint performance."""
    print("🚀 Testing HTTP endpoint performance...")
    
    # Create a test image at full resolution (like your webcam)
    test_image = np.zeros((720, 1280, 3), dtype=np.uint8)
    test_image[:] = (100, 100, 100)  # Gray background
    
    # Add some test content
    cv2.rectangle(test_image, (100, 100), (300, 400), (0, 255, 0), 2)
    cv2.putText(test_image, "Test Image", (150, 200), cv2.FONT_HERSHEY_SIMPLEX, 1, (255, 255, 255), 2)
    
    # Add some "fret-like" lines to simulate guitar frets
    for i in range(5):
        x = 200 + i * 150
        cv2.line(test_image, (x, 100), (x, 600), (0, 255, 0), 3)
        cv2.putText(test_image, f"Fret {i+1}", (x-20, 80), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 0), 1)
    
    print(f"📏 Test image size: {test_image.shape[1]}x{test_image.shape[0]} (will be resized to 640x480)")
    
    # Encode image
    _, buffer = cv2.imencode('.jpg', test_image, [cv2.IMWRITE_JPEG_QUALITY, 85])
    image_b64 = base64.b64encode(buffer.tobytes()).decode('utf-8')
    image_uri = f"data:image/jpeg;base64,{image_b64}"
    
    # Calculate original image size in KB
    original_size_kb = len(buffer.tobytes()) / 1024
    print(f"📦 Original image size: {original_size_kb:.1f} KB")
    
    # Prepare request data with timing
    request_data = {
        'image': image_uri,
        'frontend_send_time': time.time()
    }
    
    # Send request
    start_time = time.time()
    try:
        response = requests.post('http://localhost:8000/process_frame', 
                               json=request_data, 
                               headers={'Content-Type': 'application/json'})
        
        end_time = time.time()
        total_round_trip = end_time - start_time
        
        if response.status_code == 200:
            result = response.json()
            performance = result.get('performance', {})
            
            print(f"✅ HTTP Request Successful!")
            print(f"📊 Performance Breakdown:")
            print(f"   • Total Round-trip: {total_round_trip:.3f}s")
            print(f"   • Backend Total: {performance.get('total_time', 0):.3f}s")
            print(f"   • Parse Time: {performance.get('parse_time', 0):.3f}s")
            print(f"   • Decode Time: {performance.get('decode_time', 0):.3f}s")
            print(f"   • Process Time: {performance.get('process_time', 0):.3f}s")
            print(f"   • Encode Time: {performance.get('encode_time', 0):.3f}s")
            print(f"   • Network Transfer: {performance.get('network_transfer_time', 0):.3f}s")
            
            # Calculate overhead
            backend_time = performance.get('total_time', 0)
            network_overhead = total_round_trip - backend_time
            print(f"   • Network Overhead: {network_overhead:.3f}s")
            
            # Calculate improvement
            if hasattr(test_http_performance, 'baseline_time'):
                improvement = ((test_http_performance.baseline_time - total_round_trip) / test_http_performance.baseline_time) * 100
                print(f"   • Performance Improvement: {improvement:.1f}%")
            else:
                test_http_performance.baseline_time = total_round_trip
                print(f"   • Baseline established: {total_round_trip:.3f}s")
            
            return True
        else:
            print(f"❌ HTTP Request Failed: {response.status_code}")
            print(f"Response: {response.text}")
            return False
            
    except Exception as e:
        print(f"❌ HTTP Request Error: {str(e)}")
        return False

def test_multiple_requests(num_requests=5):
    """Test multiple requests to get average performance."""
    print(f"\n🔄 Testing {num_requests} consecutive requests...")
    
    times = []
    for i in range(num_requests):
        print(f"\n--- Request {i+1}/{num_requests} ---")
        start = time.time()
        success = test_http_performance()
        end = time.time()
        
        if success:
            times.append(end - start)
        
        # Small delay between requests
        time.sleep(0.5)
    
    if times:
        avg_time = sum(times) / len(times)
        min_time = min(times)
        max_time = max(times)
        
        print(f"\n📈 Performance Summary ({len(times)} successful requests):")
        print(f"   • Average Round-trip: {avg_time:.3f}s")
        print(f"   • Min Round-trip: {min_time:.3f}s")
        print(f"   • Max Round-trip: {max_time:.3f}s")
        print(f"   • FPS (theoretical): {1/avg_time:.1f}")

if __name__ == "__main__":
    print("🎯 Performance Test Script")
    print("=" * 50)
    
    # Test single request
    test_http_performance()
    
    # Test multiple requests
    test_multiple_requests(3)
    
    print("\n✅ Performance test completed!") 