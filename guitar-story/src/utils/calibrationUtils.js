// src/utils/calibrationUtils.js

/**
 * Runs calibration to find the best preprocessing filter/parameter for detection confidence.
 * @param {HTMLVideoElement} videoEl - The user's webcam video element.
 * @param {Function} runInference - Function that takes an image/canvas and returns a Promise of predictions.
 * @param {Array} filters - Array of filter configs: { name, params: [values], apply: (ctx, param) => void }
 * @param {Function} onProgress - Callback for UI updates.
 * @returns {Promise<{filter: string, param: any, avgConfidence: number, baseline: number}>}
 */
export async function calibrateDetection(videoEl, runInference, filters, onProgress) {
  // Capture a single frame from the webcam
  const staticCanvas = document.createElement('canvas');
  staticCanvas.width = videoEl.videoWidth;
  staticCanvas.height = videoEl.videoHeight;
  const staticCtx = staticCanvas.getContext('2d', { willReadFrequently: true });
  staticCtx.drawImage(videoEl, 0, 0, staticCanvas.width, staticCanvas.height);

  // Helper to run inference and get average confidence for a given filter
  async function getAvgConfidence(filterApply) {
    // Work on a copy of the static frame
    const testCanvas = document.createElement('canvas');
    testCanvas.width = staticCanvas.width;
    testCanvas.height = staticCanvas.height;
    const testCtx = testCanvas.getContext('2d', { willReadFrequently: true });
    testCtx.drawImage(staticCanvas, 0, 0, testCanvas.width, testCanvas.height);
    if (filterApply) filterApply(testCtx);
    try {
      const predictions = await runInference(testCanvas);
      if (predictions && predictions.length > 0) {
        const avg = predictions.reduce((a, b) => a + b.confidence, 0) / predictions.length;
        return avg;
      }
    } catch (e) {
      console.warn('Calibration inference error:', e);
    }
    return 0;
  }

  let best = { filter: 'none', param: null, avgConfidence: 0 };

  // Baseline (no filter)
  onProgress?.('Testing baseline...');
  best.avgConfidence = await getAvgConfidence(null);
  best.baseline = best.avgConfidence;

  // For each filter
  const totalSteps = filters.reduce((sum, f) => sum + f.params.length, 0);
  let currentStep = 0;
  for (let i = 0; i < filters.length; i++) {
    const filter = filters[i];
    for (let j = 0; j < filter.params.length; j++) {
      const param = filter.params[j];
      currentStep++;
      const percent = Math.round((currentStep / totalSteps) * 100);
      const text = `Applying ${filter.name} (${param})...`;
      onProgress && onProgress({ percent, text });
      console.log(`Applying filter: ${filter.name} (${param})`);
      const avgConfidence = await getAvgConfidence(ctx => filter.apply(ctx, param));
      console.log(`Avg confidence for ${filter.name} (${param}): ${avgConfidence}`);
      onProgress && onProgress({ percent, text: `Filter: ${filter.name} (${param}) - Avg confidence: ${avgConfidence.toFixed(3)}` });
      if (avgConfidence > best.avgConfidence) {
        best = { filter: filter.name, param, avgConfidence: avgConfidence, baseline: best.baseline };
      }
    }
  }

  return best;
}

// Example filter configs for use in your calibration component
export const CALIBRATION_FILTERS = [
  {
    name: 'brightness',
    params: [-60, -30, 0, 30, 60],
    apply: (ctx, value) => {
      const imgData = ctx.getImageData(0, 0, ctx.canvas.width, ctx.canvas.height);
      for (let i = 0; i < imgData.data.length; i += 4) {
        imgData.data[i] = Math.min(255, Math.max(0, imgData.data[i] + value));
        imgData.data[i+1] = Math.min(255, Math.max(0, imgData.data[i+1] + value));
        imgData.data[i+2] = Math.min(255, Math.max(0, imgData.data[i+2] + value));
      }
      ctx.putImageData(imgData, 0, 0);
    }
  },
  {
    name: 'contrast',
    params: [-60, -30, 0, 30, 60],
    apply: (ctx, value) => {
      const imgData = ctx.getImageData(0, 0, ctx.canvas.width, ctx.canvas.height);
      const contrast = value;
      const factor = (259 * (contrast + 255)) / (255 * (259 - contrast));
      for (let i = 0; i < imgData.data.length; i += 4) {
        imgData.data[i] = Math.max(0, Math.min(255, factor * (imgData.data[i] - 128) + 128));
        imgData.data[i+1] = Math.max(0, Math.min(255, factor * (imgData.data[i+1] - 128) + 128));
        imgData.data[i+2] = Math.max(0, Math.min(255, factor * (imgData.data[i+2] - 128) + 128));
      }
      ctx.putImageData(imgData, 0, 0);
    }
  },
  {
    name: 'grayscale',
    params: [true, false],
    apply: (ctx, value) => {
      if (!value) return;
      const imgData = ctx.getImageData(0, 0, ctx.canvas.width, ctx.canvas.height);
      for (let i = 0; i < imgData.data.length; i += 4) {
        const avg = (imgData.data[i] + imgData.data[i+1] + imgData.data[i+2]) / 3;
        imgData.data[i] = imgData.data[i+1] = imgData.data[i+2] = avg;
      }
      ctx.putImageData(imgData, 0, 0);
    }
  },
  {
    name: 'invert',
    params: [true, false],
    apply: (ctx, value) => {
      if (!value) return;
      const imgData = ctx.getImageData(0, 0, ctx.canvas.width, ctx.canvas.height);
      for (let i = 0; i < imgData.data.length; i += 4) {
        imgData.data[i] = 255 - imgData.data[i];
        imgData.data[i+1] = 255 - imgData.data[i+1];
        imgData.data[i+2] = 255 - imgData.data[i+2];
      }
      ctx.putImageData(imgData, 0, 0);
    }
  }
]; 