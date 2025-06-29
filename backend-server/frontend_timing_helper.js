/**
 * Frontend timing helper for measuring round-trip performance
 * Add this to your React app to track timing
 */

class PerformanceTracker {
    constructor() {
        this.stats = {
            totalRequests: 0,
            avgRoundTrip: 0,
            avgBackendTime: 0,
            avgNetworkTime: 0
        };
    }

    /**
     * Send frame to backend with timing
     * @param {string} imageData - Base64 image data
     * @param {string} endpoint - Backend endpoint ('/process_frame' or WebSocket)
     * @returns {Promise} - Response with performance data
     */
    async sendFrameWithTiming(imageData, endpoint = '/process_frame') {
        const frontendSendTime = Date.now() / 1000; // Convert to seconds
        const requestStartTime = performance.now();

        try {
            let response;
            
            if (endpoint === '/process_frame') {
                // HTTP request
                response = await fetch(endpoint, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        image: imageData,
                        frontend_send_time: frontendSendTime
                    })
                });
                
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }
                
                response = await response.json();
            } else {
                // WebSocket request (you'll need to implement this based on your WebSocket setup)
                console.log('WebSocket timing not implemented yet');
                return null;
            }

            const requestEndTime = performance.now();
            const totalRoundTrip = (requestEndTime - requestStartTime) / 1000; // Convert to seconds

            // Extract performance data
            const performance = response.performance || {};
            const backendTime = performance.total_time || 0;
            const networkTime = performance.network_transfer_time || 0;

            // Update stats
            this.updateStats(totalRoundTrip, backendTime, networkTime);

            // Log performance
            this.logPerformance(totalRoundTrip, backendTime, networkTime, performance);

            return response;

        } catch (error) {
            console.error('❌ Frame processing error:', error);
            throw error;
        }
    }

    /**
     * Update performance statistics
     */
    updateStats(totalRoundTrip, backendTime, networkTime) {
        this.stats.totalRequests++;
        
        // Update averages
        const n = this.stats.totalRequests;
        this.stats.avgRoundTrip = (this.stats.avgRoundTrip * (n - 1) + totalRoundTrip) / n;
        this.stats.avgBackendTime = (this.stats.avgBackendTime * (n - 1) + backendTime) / n;
        this.stats.avgNetworkTime = (this.stats.avgNetworkTime * (n - 1) + networkTime) / n;
    }

    /**
     * Log performance information
     */
    logPerformance(totalRoundTrip, backendTime, networkTime, performance) {
        console.log('📊 Performance Breakdown:');
        console.log(`   • Total Round-trip: ${totalRoundTrip.toFixed(3)}s`);
        console.log(`   • Backend Processing: ${backendTime.toFixed(3)}s`);
        console.log(`   • Network Transfer: ${networkTime.toFixed(3)}s`);
        console.log(`   • Parse Time: ${(performance.parse_time || 0).toFixed(3)}s`);
        console.log(`   • Decode Time: ${(performance.decode_time || 0).toFixed(3)}s`);
        console.log(`   • Process Time: ${(performance.process_time || 0).toFixed(3)}s`);
        console.log(`   • Encode Time: ${(performance.encode_time || 0).toFixed(3)}s`);
        
        // Calculate FPS
        const fps = 1 / totalRoundTrip;
        console.log(`   • Theoretical FPS: ${fps.toFixed(1)}`);
        
        // Log averages
        console.log(`📈 Averages (${this.stats.totalRequests} requests):`);
        console.log(`   • Avg Round-trip: ${this.stats.avgRoundTrip.toFixed(3)}s`);
        console.log(`   • Avg Backend: ${this.stats.avgBackendTime.toFixed(3)}s`);
        console.log(`   • Avg Network: ${this.stats.avgNetworkTime.toFixed(3)}s`);
    }

    /**
     * Get current performance statistics
     */
    getStats() {
        return { ...this.stats };
    }

    /**
     * Reset performance statistics
     */
    resetStats() {
        this.stats = {
            totalRequests: 0,
            avgRoundTrip: 0,
            avgBackendTime: 0,
            avgNetworkTime: 0
        };
    }
}

// Export for use in React
export default PerformanceTracker;

// Example usage in React component:
/*
import PerformanceTracker from './frontend_timing_helper';

const performanceTracker = new PerformanceTracker();

// In your component:
const sendFrame = async (imageData) => {
    try {
        const result = await performanceTracker.sendFrameWithTiming(imageData);
        // Handle result
    } catch (error) {
        console.error('Error sending frame:', error);
    }
};
*/ 