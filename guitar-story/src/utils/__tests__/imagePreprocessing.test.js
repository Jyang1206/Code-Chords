import {
  adjustBrightnessContrast,
  gammaCorrection,
  gaussianBlur,
  sharpen,
  grayscale,
  histogramEqualization,
  clahe,
  colorNormalization,
  autoWhiteBalance,
  applyFilterChainToCanvas
} from '../imagePreprocessing';

describe('Image Preprocessing Utilities', () => {
  let mockCtx;
  let mockCanvas;

  beforeEach(() => {
    // Create mock canvas and context
    mockCanvas = {
      width: 100,
      height: 100
    };

    mockCtx = {
      canvas: mockCanvas,
      getImageData: jest.fn(),
      putImageData: jest.fn(),
      drawImage: jest.fn(),
      _filter: 'none',
      set filter(value) {
        this._filter = value;
      },
      get filter() {
        return this._filter;
      }
    };
  });

  describe('adjustBrightnessContrast', () => {
    test('applies brightness and contrast adjustments', () => {
      const imageData = new ImageData(100, 100);
      const data = new Uint8ClampedArray(40000); // 100x100x4
      
      // Set some test pixel data
      for (let i = 0; i < data.length; i += 4) {
        data[i] = 100;     // Red
        data[i + 1] = 150; // Green
        data[i + 2] = 200; // Blue
        data[i + 3] = 255; // Alpha
      }
      
      imageData.data = data;
      mockCtx.getImageData.mockReturnValue(imageData);

      adjustBrightnessContrast(mockCtx, mockCanvas, 30, 1.2);

      expect(mockCtx.getImageData).toHaveBeenCalledWith(0, 0, 100, 100);
      expect(mockCtx.putImageData).toHaveBeenCalledWith(imageData, 0, 0);
    });

    test('clamps pixel values to valid range', () => {
      const imageData = new ImageData(10, 10);
      const data = new Uint8ClampedArray(400);
      
      // Set extreme values to test clamping
      for (let i = 0; i < data.length; i += 4) {
        data[i] = 0;       // Red
        data[i + 1] = 255; // Green
        data[i + 2] = 128; // Blue
        data[i + 3] = 255; // Alpha
      }
      
      imageData.data = data;
      mockCtx.getImageData.mockReturnValue(imageData);

      adjustBrightnessContrast(mockCtx, mockCanvas, 100, 2.0);

      expect(mockCtx.getImageData).toHaveBeenCalledWith(0, 0, 100, 100);
      expect(mockCtx.putImageData).toHaveBeenCalledWith(imageData, 0, 0);
    });
  });

  describe('gammaCorrection', () => {
    test('applies gamma correction with default gamma', () => {
      const imageData = new ImageData(100, 100);
      const data = new Uint8ClampedArray(40000);
      
      for (let i = 0; i < data.length; i += 4) {
        data[i] = 128;     // Red
        data[i + 1] = 128; // Green
        data[i + 2] = 128; // Blue
        data[i + 3] = 255; // Alpha
      }
      
      imageData.data = data;
      mockCtx.getImageData.mockReturnValue(imageData);

      gammaCorrection(mockCtx, mockCanvas, 1.0);

      expect(mockCtx.getImageData).toHaveBeenCalledWith(0, 0, 100, 100);
      expect(mockCtx.putImageData).toHaveBeenCalledWith(imageData, 0, 0);
    });

    test('applies gamma correction with custom gamma value', () => {
      const imageData = new ImageData(100, 100);
      const data = new Uint8ClampedArray(40000);
      
      for (let i = 0; i < data.length; i += 4) {
        data[i] = 128;     // Red
        data[i + 1] = 128; // Green
        data[i + 2] = 128; // Blue
        data[i + 3] = 255; // Alpha
      }
      
      imageData.data = data;
      mockCtx.getImageData.mockReturnValue(imageData);

      gammaCorrection(mockCtx, mockCanvas, 2.2);

      expect(mockCtx.getImageData).toHaveBeenCalledWith(0, 0, 100, 100);
      expect(mockCtx.putImageData).toHaveBeenCalledWith(imageData, 0, 0);
    });
  });

  describe('gaussianBlur', () => {
    test('applies gaussian blur filter', () => {
      gaussianBlur(mockCtx, mockCanvas);

      expect(mockCtx.drawImage).toHaveBeenCalledWith(mockCanvas, 0, 0);
    });
  });

  describe('sharpen', () => {
    test('applies sharpening filter', () => {
      sharpen(mockCtx, mockCanvas);

      expect(mockCtx.drawImage).toHaveBeenCalledWith(mockCanvas, 0, 0);
    });
  });

  describe('grayscale', () => {
    test('applies grayscale filter', () => {
      grayscale(mockCtx, mockCanvas);

      expect(mockCtx.drawImage).toHaveBeenCalledWith(mockCanvas, 0, 0);
    });
  });

  describe('histogramEqualization', () => {
    test('applies histogram equalization', () => {
      const imageData = new ImageData(100, 100);
      const data = new Uint8ClampedArray(40000);
      
      // Create test data with some variation
      for (let i = 0; i < data.length; i += 4) {
        data[i] = Math.floor(Math.random() * 256);     // Red
        data[i + 1] = Math.floor(Math.random() * 256); // Green
        data[i + 2] = Math.floor(Math.random() * 256); // Blue
        data[i + 3] = 255; // Alpha
      }
      
      imageData.data = data;
      mockCtx.getImageData.mockReturnValue(imageData);

      histogramEqualization(mockCtx, mockCanvas);

      expect(mockCtx.getImageData).toHaveBeenCalledWith(0, 0, 100, 100);
      expect(mockCtx.putImageData).toHaveBeenCalledWith(imageData, 0, 0);
    });
  });

  describe('clahe', () => {
    test('applies CLAHE (calls histogramEqualization)', () => {
      const imageData = new ImageData(100, 100);
      const data = new Uint8ClampedArray(40000);
      
      for (let i = 0; i < data.length; i += 4) {
        data[i] = Math.floor(Math.random() * 256);
        data[i + 1] = Math.floor(Math.random() * 256);
        data[i + 2] = Math.floor(Math.random() * 256);
        data[i + 3] = 255;
      }
      
      imageData.data = data;
      mockCtx.getImageData.mockReturnValue(imageData);

      clahe(mockCtx, mockCanvas);

      expect(mockCtx.getImageData).toHaveBeenCalledWith(0, 0, 100, 100);
      expect(mockCtx.putImageData).toHaveBeenCalledWith(imageData, 0, 0);
    });
  });

  describe('colorNormalization', () => {
    test('applies color normalization', () => {
      const imageData = new ImageData(100, 100);
      const data = new Uint8ClampedArray(40000);
      
      for (let i = 0; i < data.length; i += 4) {
        data[i] = 100;     // Red
        data[i + 1] = 150; // Green
        data[i + 2] = 200; // Blue
        data[i + 3] = 255; // Alpha
      }
      
      imageData.data = data;
      mockCtx.getImageData.mockReturnValue(imageData);

      colorNormalization(mockCtx, mockCanvas);

      expect(mockCtx.getImageData).toHaveBeenCalledWith(0, 0, 100, 100);
      expect(mockCtx.putImageData).toHaveBeenCalledWith(imageData, 0, 0);
    });
  });

  describe('autoWhiteBalance', () => {
    test('applies auto white balance', () => {
      const imageData = new ImageData(100, 100);
      const data = new Uint8ClampedArray(40000);
      
      for (let i = 0; i < data.length; i += 4) {
        data[i] = 100;     // Red
        data[i + 1] = 150; // Green
        data[i + 2] = 200; // Blue
        data[i + 3] = 255; // Alpha
      }
      
      imageData.data = data;
      mockCtx.getImageData.mockReturnValue(imageData);

      autoWhiteBalance(mockCtx, mockCanvas);

      expect(mockCtx.getImageData).toHaveBeenCalledWith(0, 0, 100, 100);
      expect(mockCtx.putImageData).toHaveBeenCalledWith(imageData, 0, 0);
    });
  });

  describe('applyFilterChainToCanvas', () => {
    test('applies filter chain correctly', () => {
      const filterChain = [
        { filter: 'brightness', param: 30 },
        { filter: 'contrast', param: 1.2 }
      ];

      const filters = [
        {
          name: 'brightness',
          apply: jest.fn()
        },
        {
          name: 'contrast',
          apply: jest.fn()
        }
      ];

      applyFilterChainToCanvas(mockCtx, filterChain, filters);

      expect(filters[0].apply).toHaveBeenCalledWith(mockCtx, 30);
      expect(filters[1].apply).toHaveBeenCalledWith(mockCtx, 1.2);
    });

    test('handles empty filter chain', () => {
      const filterChain = [];
      const filters = [];

      expect(() => {
        applyFilterChainToCanvas(mockCtx, filterChain, filters);
      }).not.toThrow();
    });

    test('handles null filter chain', () => {
      const filters = [];

      expect(() => {
        applyFilterChainToCanvas(mockCtx, null, filters);
      }).not.toThrow();
    });

    test('handles non-array filter chain', () => {
      const filterChain = 'not an array';
      const filters = [];

      expect(() => {
        applyFilterChainToCanvas(mockCtx, filterChain, filters);
      }).not.toThrow();
    });

    test('skips filters that are not found', () => {
      const filterChain = [
        { filter: 'nonexistent', param: 30 },
        { filter: 'brightness', param: 30 }
      ];

      const filters = [
        {
          name: 'brightness',
          apply: jest.fn()
        }
      ];

      applyFilterChainToCanvas(mockCtx, filterChain, filters);

      expect(filters[0].apply).toHaveBeenCalledWith(mockCtx, 30);
    });

    test('skips filters without apply method', () => {
      const filterChain = [
        { filter: 'brightness', param: 30 }
      ];

      const filters = [
        {
          name: 'brightness'
          // No apply method
        }
      ];

      expect(() => {
        applyFilterChainToCanvas(mockCtx, filterChain, filters);
      }).not.toThrow();
    });
  });

  describe('Edge Cases and Error Handling', () => {
    test('handles canvas with zero dimensions', () => {
      mockCanvas.width = 0;
      mockCanvas.height = 0;

      const imageData = new ImageData(0, 0);
      const data = new Uint8ClampedArray(0);
      imageData.data = data;
      mockCtx.getImageData.mockReturnValue(imageData);

      expect(() => {
        adjustBrightnessContrast(mockCtx, mockCanvas, 30, 1.2);
      }).not.toThrow();
    });

    test('handles very large canvas dimensions', () => {
      mockCanvas.width = 10000;
      mockCanvas.height = 10000;

      const imageData = new ImageData(10000, 10000);
      const data = new Uint8ClampedArray(400000000); // 10000x10000x4
      imageData.data = data;
      mockCtx.getImageData.mockReturnValue(imageData);

      expect(() => {
        adjustBrightnessContrast(mockCtx, mockCanvas, 30, 1.2);
      }).not.toThrow();
    });
  });
}); 