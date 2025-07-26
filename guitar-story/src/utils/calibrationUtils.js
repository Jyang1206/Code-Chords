// src/utils/calibrationUtils.js

/**
 * Runs chained calibration: for each filter, test all settings in combination with the previous best chain.
 * Only add a filter to the chain if it increases confidence. Save the final chain as the calibrated filter.
 * Returns { filterChain: [{filter, param}], avgConfidence, baseline }
 */
export async function calibrateDetection(videoEl, runInference, filters, onProgress) {
  // Capture a single frame from the webcam
  const staticCanvas = document.createElement('canvas');
  staticCanvas.width = videoEl.videoWidth;
  staticCanvas.height = videoEl.videoHeight;
  const staticCtx = staticCanvas.getContext('2d', { willReadFrequently: true });
  staticCtx.drawImage(videoEl, 0, 0, staticCanvas.width, staticCanvas.height);

  // Helper to apply a chain of filters
  function applyFilterChain(ctx, filterChain) {
    for (const f of filterChain) {
      const filterObj = filters.find(fl => fl.name === f.filter);
      if (filterObj && filterObj.apply) {
        filterObj.apply(ctx, f.param);
      }
    }
  }

  // Helper to run inference and get average confidence for a given filter chain
  async function getAvgConfidence(filterChain) {
    // Work on a copy of the static frame
    const testCanvas = document.createElement('canvas');
    testCanvas.width = staticCanvas.width;
    testCanvas.height = staticCanvas.height;
    const testCtx = testCanvas.getContext('2d', { willReadFrequently: true });
    testCtx.drawImage(staticCanvas, 0, 0, testCanvas.width, testCanvas.height);
    if (filterChain && filterChain.length > 0) applyFilterChain(testCtx, filterChain);
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

  // Baseline (no filter)
  onProgress?.('Testing baseline...');
  const baseline = await getAvgConfidence([]);
  let bestChain = [];
  let bestConfidence = baseline;
  console.log(`[Calibration] Baseline confidence: ${(baseline * 100).toFixed(2)}%`);

  // Chained filter search
  let currentChain = [];
  for (let i = 0; i < filters.length; i++) {
    const filter = filters[i];
    let bestForThisFilter = null;
    let bestForThisConfidence = bestConfidence;
    for (let j = 0; j < filter.params.length; j++) {
      const param = filter.params[j];
      const testChain = [...currentChain, { filter: filter.name, param }];
      const chainStr = testChain.map(f => `${f.filter}${f.param !== null ? `(${f.param})` : ''}`).join(' -> ');
      onProgress && onProgress({ percent: Math.round((i / filters.length) * 100), text: `Testing chain: ${chainStr}` });
      console.log(`[Calibration] Testing chain: ${chainStr}`);
      const avgConfidence = await getAvgConfidence(testChain);
      onProgress && onProgress({ percent: Math.round((i / filters.length) * 100), text: `Chain: ${chainStr} - Avg confidence: ${(avgConfidence*100).toFixed(2)}%` });
      console.log(`[Calibration] Chain: ${chainStr} - Avg confidence: ${(avgConfidence*100).toFixed(2)}%`);
      if (avgConfidence > bestForThisConfidence) {
        bestForThisConfidence = avgConfidence;
        bestForThisFilter = { filter: filter.name, param };
      }
    }
    // Only add this filter if it improved confidence
    if (bestForThisFilter && bestForThisConfidence > bestConfidence) {
      currentChain.push(bestForThisFilter);
      bestConfidence = bestForThisConfidence;
      const chainStr = currentChain.map(f => `${f.filter}${f.param !== null ? `(${f.param})` : ''}`).join(' -> ');
      console.log(`[Calibration] Added filter to chain: ${chainStr} (Confidence: ${(bestConfidence*100).toFixed(2)}%)`);
    } else {
      console.log(`[Calibration] Skipped filter '${filter.name}' (no improvement)`);
    }
  }
  const finalChainStr = currentChain.length > 0 ? currentChain.map(f => `${f.filter}${f.param !== null ? `(${f.param})` : ''}`).join(' -> ') : 'none';
  console.log(`[Calibration] Final filter chain: ${finalChainStr}`);
  console.log(`[Calibration] Final confidence: ${(bestConfidence*100).toFixed(2)}% | Baseline: ${(baseline*100).toFixed(2)}%`);
  return {
    filterChain: currentChain,
    avgConfidence: bestConfidence,
    baseline
  };
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