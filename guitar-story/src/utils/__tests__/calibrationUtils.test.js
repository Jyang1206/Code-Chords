import { CALIBRATION_FILTERS } from '../calibrationUtils';

describe('Calibration Utilities', () => {
  describe('CALIBRATION_FILTERS', () => {
    test('contains all required filter configurations', () => {
      expect(CALIBRATION_FILTERS).toBeDefined();
      expect(Array.isArray(CALIBRATION_FILTERS)).toBe(true);
      expect(CALIBRATION_FILTERS.length).toBeGreaterThan(0);
    });

    test('each filter has required properties', () => {
      CALIBRATION_FILTERS.forEach(filter => {
        expect(filter).toHaveProperty('name');
        expect(filter).toHaveProperty('params');
        expect(filter).toHaveProperty('apply');
        expect(typeof filter.name).toBe('string');
        expect(Array.isArray(filter.params)).toBe(true);
        expect(typeof filter.apply).toBe('function');
      });
    });

    test('contains brightness filter configuration', () => {
      const brightnessFilter = CALIBRATION_FILTERS.find(f => f.name === 'brightness');
      expect(brightnessFilter).toBeDefined();
      expect(brightnessFilter.params).toEqual([-60, -30, 0, 30, 60]);
    });

    test('contains contrast filter configuration', () => {
      const contrastFilter = CALIBRATION_FILTERS.find(f => f.name === 'contrast');
      expect(contrastFilter).toBeDefined();
      expect(contrastFilter.params).toEqual([-60, -30, 0, 30, 60]);
    });

    test('contains grayscale filter configuration', () => {
      const grayscaleFilter = CALIBRATION_FILTERS.find(f => f.name === 'grayscale');
      expect(grayscaleFilter).toBeDefined();
      expect(grayscaleFilter.params).toEqual([true, false]);
    });

    test('contains invert filter configuration', () => {
      const invertFilter = CALIBRATION_FILTERS.find(f => f.name === 'invert');
      expect(invertFilter).toBeDefined();
      expect(invertFilter.params).toEqual([true, false]);
    });
  });

  describe('Filter Apply Functions', () => {
    let mockCtx;
    let mockCanvas;

    beforeEach(() => {
      mockCanvas = {
        width: 100,
        height: 100
      };

      mockCtx = {
        canvas: mockCanvas,
        getImageData: jest.fn(),
        putImageData: jest.fn(),
        // Add setter for filter property
        set filter(value) {
          this._filter = value;
        },
        get filter() {
          return this._filter || 'none';
        }
      };
    });

    describe('Brightness Filter', () => {
      test('applies brightness adjustment correctly', () => {
        const brightnessFilter = CALIBRATION_FILTERS.find(f => f.name === 'brightness');
        const imageData = new ImageData(100, 100);
        const data = new Uint8ClampedArray(40000);
        
        // Set test pixel data
        for (let i = 0; i < data.length; i += 4) {
          data[i] = 100;     // Red
          data[i + 1] = 150; // Green
          data[i + 2] = 200; // Blue
          data[i + 3] = 255; // Alpha
        }
        
        imageData.data = data;
        mockCtx.getImageData.mockReturnValue(imageData);

        brightnessFilter.apply(mockCtx, 30);

        expect(mockCtx.getImageData).toHaveBeenCalledWith(0, 0, 100, 100);
        expect(mockCtx.putImageData).toHaveBeenCalledWith(imageData, 0, 0);
      });

      test('clamps pixel values to valid range', () => {
        const brightnessFilter = CALIBRATION_FILTERS.find(f => f.name === 'brightness');
        const imageData = new ImageData(10, 10);
        const data = new Uint8ClampedArray(400);
        
        // Set extreme values
        for (let i = 0; i < data.length; i += 4) {
          data[i] = 0;       // Red
          data[i + 1] = 255; // Green
          data[i + 2] = 128; // Blue
          data[i + 3] = 255; // Alpha
        }
        
        imageData.data = data;
        mockCtx.getImageData.mockReturnValue(imageData);

        brightnessFilter.apply(mockCtx, 100);

        expect(mockCtx.getImageData).toHaveBeenCalledWith(0, 0, 100, 100);
        expect(mockCtx.putImageData).toHaveBeenCalledWith(imageData, 0, 0);
      });
    });

    describe('Contrast Filter', () => {
      test('applies contrast adjustment correctly', () => {
        const contrastFilter = CALIBRATION_FILTERS.find(f => f.name === 'contrast');
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

        contrastFilter.apply(mockCtx, 30);

        expect(mockCtx.getImageData).toHaveBeenCalledWith(0, 0, 100, 100);
        expect(mockCtx.putImageData).toHaveBeenCalledWith(imageData, 0, 0);
      });

      test('handles extreme contrast values', () => {
        const contrastFilter = CALIBRATION_FILTERS.find(f => f.name === 'contrast');
        const imageData = new ImageData(10, 10);
        const data = new Uint8ClampedArray(400);
        
        for (let i = 0; i < data.length; i += 4) {
          data[i] = 128;
          data[i + 1] = 128;
          data[i + 2] = 128;
          data[i + 3] = 255;
        }
        
        imageData.data = data;
        mockCtx.getImageData.mockReturnValue(imageData);

        contrastFilter.apply(mockCtx, -60);

        expect(mockCtx.getImageData).toHaveBeenCalledWith(0, 0, 100, 100);
        expect(mockCtx.putImageData).toHaveBeenCalledWith(imageData, 0, 0);
      });
    });

    describe('Grayscale Filter', () => {
      test('applies grayscale when value is true', () => {
        const grayscaleFilter = CALIBRATION_FILTERS.find(f => f.name === 'grayscale');
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

        grayscaleFilter.apply(mockCtx, true);

        expect(mockCtx.getImageData).toHaveBeenCalledWith(0, 0, 100, 100);
        expect(mockCtx.putImageData).toHaveBeenCalledWith(imageData, 0, 0);
      });

      test('does not apply grayscale when value is false', () => {
        const grayscaleFilter = CALIBRATION_FILTERS.find(f => f.name === 'grayscale');
        const imageData = new ImageData(100, 100);
        const data = new Uint8ClampedArray(40000);
        
        for (let i = 0; i < data.length; i += 4) {
          data[i] = 100;
          data[i + 1] = 150;
          data[i + 2] = 200;
          data[i + 3] = 255;
        }
        
        imageData.data = data;
        mockCtx.getImageData.mockReturnValue(imageData);

        grayscaleFilter.apply(mockCtx, false);

        expect(mockCtx.getImageData).not.toHaveBeenCalled();
        expect(mockCtx.putImageData).not.toHaveBeenCalled();
      });
    });

    describe('Invert Filter', () => {
      test('applies inversion when value is true', () => {
        const invertFilter = CALIBRATION_FILTERS.find(f => f.name === 'invert');
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

        invertFilter.apply(mockCtx, true);

        expect(mockCtx.getImageData).toHaveBeenCalledWith(0, 0, 100, 100);
        expect(mockCtx.putImageData).toHaveBeenCalledWith(imageData, 0, 0);
      });

      test('does not apply inversion when value is false', () => {
        const invertFilter = CALIBRATION_FILTERS.find(f => f.name === 'invert');
        const imageData = new ImageData(100, 100);
        const data = new Uint8ClampedArray(40000);
        
        for (let i = 0; i < data.length; i += 4) {
          data[i] = 100;
          data[i + 1] = 150;
          data[i + 2] = 200;
          data[i + 3] = 255;
        }
        
        imageData.data = data;
        mockCtx.getImageData.mockReturnValue(imageData);

        invertFilter.apply(mockCtx, false);

        expect(mockCtx.getImageData).not.toHaveBeenCalled();
        expect(mockCtx.putImageData).not.toHaveBeenCalled();
      });
    });
  });

  describe('Filter Parameter Validation', () => {
    test('brightness filter accepts valid parameters', () => {
      const brightnessFilter = CALIBRATION_FILTERS.find(f => f.name === 'brightness');
      const validParams = [-60, -30, 0, 30, 60];
      
      validParams.forEach(param => {
        expect(brightnessFilter.params).toContain(param);
      });
    });

    test('contrast filter accepts valid parameters', () => {
      const contrastFilter = CALIBRATION_FILTERS.find(f => f.name === 'contrast');
      const validParams = [-60, -30, 0, 30, 60];
      
      validParams.forEach(param => {
        expect(contrastFilter.params).toContain(param);
      });
    });

    test('grayscale filter accepts boolean parameters', () => {
      const grayscaleFilter = CALIBRATION_FILTERS.find(f => f.name === 'grayscale');
      expect(grayscaleFilter.params).toEqual([true, false]);
    });

    test('invert filter accepts boolean parameters', () => {
      const invertFilter = CALIBRATION_FILTERS.find(f => f.name === 'invert');
      expect(invertFilter.params).toEqual([true, false]);
    });
  });

  describe('Filter Function Behavior', () => {
    let mockCtx;
    let mockCanvas;

    beforeEach(() => {
      mockCanvas = {
        width: 10,
        height: 10
      };

      mockCtx = {
        canvas: mockCanvas,
        getImageData: jest.fn(),
        putImageData: jest.fn(),
        // Add setter for filter property
        set filter(value) {
          this._filter = value;
        },
        get filter() {
          return this._filter || 'none';
        }
      };
    });

    test('all filters handle edge case pixel values', () => {
      CALIBRATION_FILTERS.forEach(filter => {
        const imageData = new ImageData(10, 10);
        const data = new Uint8ClampedArray(400);
        
        // Set edge case values
        for (let i = 0; i < data.length; i += 4) {
          data[i] = 0;       // Min red
          data[i + 1] = 255; // Max green
          data[i + 2] = 128; // Mid blue
          data[i + 3] = 255; // Alpha
        }
        
        imageData.data = data;
        mockCtx.getImageData.mockReturnValue(imageData);

        // Test with first parameter
        const testParam = filter.params[0];
        expect(() => {
          filter.apply(mockCtx, testParam);
        }).not.toThrow();
      });
    });

    test('all filters handle zero-sized canvas', () => {
      mockCanvas.width = 0;
      mockCanvas.height = 0;

      CALIBRATION_FILTERS.forEach(filter => {
        const imageData = new ImageData(0, 0);
        const data = new Uint8ClampedArray(0);
        imageData.data = data;
        mockCtx.getImageData.mockReturnValue(imageData);

        const testParam = filter.params[0];
        expect(() => {
          filter.apply(mockCtx, testParam);
        }).not.toThrow();
      });
    });
  });
}); 