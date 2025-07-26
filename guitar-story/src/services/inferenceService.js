import { InferenceEngine, CVImage } from "inferencejs";

class InferenceService {
  constructor() {
    this.engine = new InferenceEngine();
    this.workerId = null;
    this.isLoading = false;
    this.subscribers = new Set();
  }

  async startWorker() {
    if (this.workerId) {
      console.log('Inference worker already started:', this.workerId);
      return this.workerId;
    }

    if (this.isLoading) {
      console.log('Inference worker is already loading...');
      return null;
    }

    this.isLoading = true;
    console.log('Starting shared inference worker...');

    try {
      this.workerId = await this.engine.startWorker(
        "guitar-fretboard-tn3dc",
        2,
        "rf_WjCqW7ti3EQQzaSufa5ZNPoCu522"
      );
      console.log('Shared inference worker started successfully:', this.workerId);
      this.isLoading = false;
      this.notifySubscribers();
      return this.workerId;
    } catch (error) {
      console.error('Failed to start shared inference worker:', error);
      this.isLoading = false;
      this.notifySubscribers();
      throw error;
    }
  }

  async infer(videoElement) {
    if (!this.workerId) {
      console.warn('Inference worker not started');
      return [];
    }

    try {
      // Handle both video elements and canvas elements
      let imgBitmap;
      if (videoElement instanceof HTMLVideoElement) {
        console.log('Inference: Using video element directly');
        imgBitmap = await createImageBitmap(videoElement);
      } else if (videoElement instanceof HTMLCanvasElement) {
        console.log('Inference: Using canvas element with dimensions:', videoElement.width, 'x', videoElement.height);
        imgBitmap = await createImageBitmap(videoElement);
      } else {
        console.error('Invalid input for inference:', videoElement);
        return [];
      }
      
      const img = new CVImage(imgBitmap);
      console.log('Inference: Sending CVImage to Roboflow with dimensions:', imgBitmap.width, 'x', imgBitmap.height);
      const predictions = await this.engine.infer(this.workerId, img);
      console.log('Inference: Received predictions from Roboflow:', predictions.length);
      return predictions;
    } catch (error) {
      console.error('Inference error:', error);
      return [];
    }
  }

  subscribe(callback) {
    this.subscribers.add(callback);
    // Immediately call with current state
    callback({
      workerId: this.workerId,
      isLoading: this.isLoading
    });
  }

  unsubscribe(callback) {
    this.subscribers.delete(callback);
  }

  notifySubscribers() {
    this.subscribers.forEach(callback => {
      callback({
        workerId: this.workerId,
        isLoading: this.isLoading
      });
    });
  }

  getStatus() {
    return {
      workerId: this.workerId,
      isLoading: this.isLoading
    };
  }
}

// Create a singleton instance
const inferenceService = new InferenceService();

export default inferenceService;
export { CVImage }; 