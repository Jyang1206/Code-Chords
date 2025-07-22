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
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  canvas.width = videoEl.videoWidth;
  canvas.height = videoEl.videoHeight;

  // Helper to run inference and get average confidence
  async function getAvgConfidence(filterApply) {
    const confidences = [];
    const start = Date.now();
    while (Date.now() - start < 2000) { // 2 seconds per test
      ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height);
      if (filterApply) filterApply(ctx);
      const predictions = await runInference(canvas);
      if (predictions && predictions.length > 0) {
        confidences.push(...predictions.map(p => p.confidence));
      }
      await new Promise(r => setTimeout(r, 100)); // 10 fps
    }
    return confidences.length ? confidences.reduce((a, b) => a + b, 0) / confidences.length : 0;
  }

  let best = { filter: 'none', param: null, avgConfidence: 0 };

  // Baseline (no filter)
  onProgress?.('Testing baseline...');
  best.avgConfidence = await getAvgConfidence(null);
  best.baseline = best.avgConfidence;

  // For each filter
  for (const filter of filters) {
    for (const param of filter.params) {
      onProgress?.(`Testing ${filter.name} param ${param}...`);
      const avgConf = await getAvgConfidence(ctx => filter.apply(ctx, param));
      if (avgConf > best.avgConfidence) {
        best = { filter: filter.name, param, avgConfidence: avgConf, baseline: best.baseline };
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