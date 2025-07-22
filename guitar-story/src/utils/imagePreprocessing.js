// Brightness/Contrast
export function adjustBrightnessContrast(ctx, canvas, brightness = 0, contrast = 1) {
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;
  for (let i = 0; i < data.length; i += 4) {
    for (let j = 0; j < 3; j++) {
      let val = data[i + j];
      val = contrast * (val - 128) + 128 + brightness;
      data[i + j] = Math.max(0, Math.min(255, val));
    }
  }
  ctx.putImageData(imageData, 0, 0);
}

// Gamma Correction
export function gammaCorrection(ctx, canvas, gamma = 1.0) {
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;
  const invGamma = 1 / gamma;
  for (let i = 0; i < data.length; i += 4) {
    for (let j = 0; j < 3; j++) {
      data[i + j] = Math.pow(data[i + j] / 255, invGamma) * 255;
    }
  }
  ctx.putImageData(imageData, 0, 0);
}

// Gaussian Blur (simple 3x3 kernel using canvas filter API)
export function gaussianBlur(ctx, canvas) {
  ctx.filter = 'blur(2px)';
  ctx.drawImage(canvas, 0, 0);
  ctx.filter = 'none';
}

// Sharpening (simple kernel using canvas filter API)
export function sharpen(ctx, canvas) {
  ctx.filter = 'contrast(1.2) brightness(1.05)';
  ctx.drawImage(canvas, 0, 0);
  ctx.filter = 'none';
}

// Grayscale
export function grayscale(ctx, canvas) {
  ctx.filter = 'grayscale(1)';
  ctx.drawImage(canvas, 0, 0);
  ctx.filter = 'none';
}

// Histogram Equalization (approximate, per channel)
export function histogramEqualization(ctx, canvas) {
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;
  for (let c = 0; c < 3; c++) {
    const hist = new Array(256).fill(0);
    for (let i = c; i < data.length; i += 4) hist[data[i]]++;
    const cdf = new Array(256).fill(0);
    cdf[0] = hist[0];
    for (let i = 1; i < 256; i++) cdf[i] = cdf[i - 1] + hist[i];
    const cdfMin = cdf.find(v => v > 0);
    const total = cdf[255];
    for (let i = c; i < data.length; i += 4) {
      data[i] = Math.round((cdf[data[i]] - cdfMin) / (total - cdfMin) * 255);
    }
  }
  ctx.putImageData(imageData, 0, 0);
}

// CLAHE (approximate, not true CLAHE)
export function clahe(ctx, canvas) {
  histogramEqualization(ctx, canvas);
}

// Color Normalization (mean subtraction)
export function colorNormalization(ctx, canvas) {
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;
  let mean = [0, 0, 0];
  for (let i = 0; i < data.length; i += 4) {
    mean[0] += data[i];
    mean[1] += data[i + 1];
    mean[2] += data[i + 2];
  }
  mean = mean.map(m => m / (data.length / 4));
  for (let i = 0; i < data.length; i += 4) {
    for (let j = 0; j < 3; j++) {
      data[i + j] = Math.max(0, Math.min(255, data[i + j] - mean[j] + 128));
    }
  }
  ctx.putImageData(imageData, 0, 0);
}

// Auto White Balance (approximate, gray world)
export function autoWhiteBalance(ctx, canvas) {
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;
  let avg = [0, 0, 0];
  for (let i = 0; i < data.length; i += 4) {
    avg[0] += data[i];
    avg[1] += data[i + 1];
    avg[2] += data[i + 2];
  }
  avg = avg.map(a => a / (data.length / 4));
  const gray = (avg[0] + avg[1] + avg[2]) / 3;
  const scale = avg.map(a => gray / a);
  for (let i = 0; i < data.length; i += 4) {
    for (let j = 0; j < 3; j++) {
      data[i + j] = Math.max(0, Math.min(255, data[i + j] * scale[j]));
    }
  }
  ctx.putImageData(imageData, 0, 0);
} 