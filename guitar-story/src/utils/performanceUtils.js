// Performance optimization utilities for guitar detection

// Frame rate throttling
export class FrameRateThrottler {
  constructor(targetFPS = 30) {
    this.targetFPS = targetFPS;
    this.frameInterval = 1000 / targetFPS;
    this.lastFrameTime = 0;
  }

  shouldProcessFrame() {
    const currentTime = performance.now();
    if (currentTime - this.lastFrameTime >= this.frameInterval) {
      this.lastFrameTime = currentTime;
      return true;
    }
    return false;
  }

  reset() {
    this.lastFrameTime = 0;
  }
}

// Memory management for canvas operations
export class CanvasManager {
  constructor(width, height) {
    this.width = width;
    this.height = height;
    this.canvas = null;
    this.ctx = null;
    this.imageCache = new Map();
    this.maxCacheSize = 10;
  }

  createCanvas() {
    if (!this.canvas) {
      this.canvas = document.createElement('canvas');
      this.canvas.width = this.width;
      this.canvas.height = this.height;
      this.ctx = this.canvas.getContext('2d', {
        alpha: false,
        desynchronized: true,
        willReadFrequently: false
      });
    }
    return this.canvas;
  }

  optimizeContext() {
    if (this.ctx) {
      // Optimize for performance
      this.ctx.imageSmoothingEnabled = false;
      this.ctx.imageSmoothingQuality = 'low';
    }
  }

  clearCache() {
    this.imageCache.clear();
  }

  cacheImage(key, imageData) {
    if (this.imageCache.size >= this.maxCacheSize) {
      const firstKey = this.imageCache.keys().next().value;
      this.imageCache.delete(firstKey);
    }
    this.imageCache.set(key, imageData);
  }

  getCachedImage(key) {
    return this.imageCache.get(key);
  }
}

// WebSocket connection manager with reconnection logic
export class WebSocketManager {
  constructor(url, options = {}) {
    this.url = url;
    this.options = {
      reconnectAttempts: 5,
      reconnectDelay: 1000,
      maxReconnectDelay: 5000,
      ...options
    };
    this.socket = null;
    this.reconnectAttempts = 0;
    this.reconnectTimer = null;
    this.eventHandlers = new Map();
  }

  connect() {
    try {
      this.socket = io(this.url, {
        transports: ['websocket'],
        upgrade: false,
        forceNew: true,
        timeout: 5000,
        ...this.options
      });

      this.setupEventHandlers();
      return this.socket;
    } catch (error) {
      console.error('WebSocket connection failed:', error);
      this.scheduleReconnect();
      return null;
    }
  }

  setupEventHandlers() {
    this.socket.on('connect', () => {
      console.log('WebSocket connected');
      this.reconnectAttempts = 0;
      this.triggerEvent('connect');
    });

    this.socket.on('disconnect', () => {
      console.log('WebSocket disconnected');
      this.triggerEvent('disconnect');
      this.scheduleReconnect();
    });

    this.socket.on('error', (error) => {
      console.error('WebSocket error:', error);
      this.triggerEvent('error', error);
    });
  }

  scheduleReconnect() {
    if (this.reconnectAttempts >= this.options.reconnectAttempts) {
      console.error('Max reconnection attempts reached');
      this.triggerEvent('maxReconnectAttempts');
      return;
    }

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }

    const delay = Math.min(
      this.options.reconnectDelay * Math.pow(2, this.reconnectAttempts),
      this.options.maxReconnectDelay
    );

    this.reconnectTimer = setTimeout(() => {
      this.reconnectAttempts++;
      console.log(`Attempting reconnection ${this.reconnectAttempts}/${this.options.reconnectAttempts}`);
      this.connect();
    }, delay);
  }

  on(event, handler) {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, []);
    }
    this.eventHandlers.get(event).push(handler);
  }

  triggerEvent(event, data) {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      handlers.forEach(handler => handler(data));
    }
  }

  emit(event, data) {
    if (this.socket && this.socket.connected) {
      this.socket.emit(event, data);
    }
  }

  disconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  isConnected() {
    return this.socket && this.socket.connected;
  }
}

// Image compression utilities
export class ImageCompressor {
  static async compressCanvas(canvas, quality = 0.85, maxWidth = 640) {
    return new Promise((resolve) => {
      const ctx = canvas.getContext('2d');
      const originalWidth = canvas.width;
      const originalHeight = canvas.height;
      
      // Calculate new dimensions while maintaining aspect ratio
      const scale = Math.min(1, maxWidth / originalWidth);
      const newWidth = Math.round(originalWidth * scale);
      const newHeight = Math.round(originalHeight * scale);
      
      // Create a temporary canvas for resizing
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = newWidth;
      tempCanvas.height = newHeight;
      const tempCtx = tempCanvas.getContext('2d');
      
      // Optimize context for performance
      tempCtx.imageSmoothingEnabled = false;
      tempCtx.imageSmoothingQuality = 'low';
      
      // Draw and resize
      tempCtx.drawImage(canvas, 0, 0, newWidth, newHeight);
      
      // Convert to base64 with specified quality
      const compressedData = tempCanvas.toDataURL('image/jpeg', quality);
      resolve(compressedData);
    });
  }

  static async compressImageData(imageData, quality = 0.85, maxWidth = 640) {
    return new Promise((resolve) => {
      const canvas = document.createElement('canvas');
      canvas.width = imageData.width;
      canvas.height = imageData.height;
      const ctx = canvas.getContext('2d');
      ctx.putImageData(imageData, 0, 0);
      
      this.compressCanvas(canvas, quality, maxWidth).then(resolve);
    });
  }
}

// Performance monitoring
export class PerformanceMonitor {
  constructor() {
    this.metrics = {
      frameCount: 0,
      totalProcessingTime: 0,
      averageProcessingTime: 0,
      fps: 0,
      lastFrameTime: 0
    };
    this.frameTimes = [];
    this.maxFrameTimes = 60; // Keep last 60 frames for FPS calculation
  }

  startFrame() {
    this.metrics.lastFrameTime = performance.now();
  }

  endFrame() {
    const frameTime = performance.now() - this.metrics.lastFrameTime;
    this.metrics.frameCount++;
    this.metrics.totalProcessingTime += frameTime;
    this.metrics.averageProcessingTime = this.metrics.totalProcessingTime / this.metrics.frameCount;
    
    this.frameTimes.push(frameTime);
    if (this.frameTimes.length > this.maxFrameTimes) {
      this.frameTimes.shift();
    }
    
    // Calculate FPS from recent frames
    const recentFrameTime = this.frameTimes.reduce((sum, time) => sum + time, 0) / this.frameTimes.length;
    this.metrics.fps = Math.round(1000 / recentFrameTime);
  }

  getMetrics() {
    return { ...this.metrics };
  }

  reset() {
    this.metrics = {
      frameCount: 0,
      totalProcessingTime: 0,
      averageProcessingTime: 0,
      fps: 0,
      lastFrameTime: 0
    };
    this.frameTimes = [];
  }
}

// Debounce utility for UI updates
export function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// Throttle utility for frequent events
export function throttle(func, limit) {
  let inThrottle;
  return function() {
    const args = arguments;
    const context = this;
    if (!inThrottle) {
      func.apply(context, args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
} 