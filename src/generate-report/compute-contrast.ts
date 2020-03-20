import * as util from '../util';
import { getImageDataPixel } from "../image-decode-encode";

/**
 * Computes the AA contrast rating (pass/fail) for the given text layer, at the given
 * opacity, using the background determined by the given rectangular cutout of the given
 * image.
 */
export function computeTypeContrast(textNodeInfo: TextNodeInfo, bgImageData: ImageData): ContrastResult {
  let {x, y, w, h, isBold, textSize, color, effectiveOpacity} = textNodeInfo;
  if (!color) {
    // show error
    return {
      aa: {status: 'unknown', contrastRatio: 0 },
      aaa: {status: 'unknown', contrastRatio: 0 }
    };
  }

  let samplePoints = [
    // TODO: adaptive sampling?
    [x, y],
    // as of last testing, runtime diff. sampling 4 vs. 1 points only took ~5% longer
    [x + w - 1, y],
    [x, y + h - 1],
    [x + h - 1, y + h - 1],
  ];

  let pointSize = textSize / 1.333333333; // CSS px -> pt
  let largeText = pointSize >= 18 || (isBold && pointSize >= 14);
  let passingAAContrastForLayer = largeText ? 3 : 4.5;
  let passingAAAContrastForLayer = largeText ? 4.5 : 7;

  let stats = {aaFail: 0, aaPass: 0, aaaFail: 0, aaaPass: 0, minCR: Infinity, maxCR: 0};

  for (let [x_, y_] of samplePoints) {
    let bgColor = getImageDataPixel(bgImageData, x_, y_);
    if (!bgColor) {
      // likely this sample point is out of bounds
      continue;
    }

    bgColor = util.flattenColors(bgColor, {r:1,g:1,b:1,a:1}); // flatten bgColor on a white matte
    let blendedTextColor = util.mixColors(bgColor, color,
        color.a * effectiveOpacity);

    let lum1 = util.srgbLuminance(blendedTextColor);
    let lum2 = util.srgbLuminance(bgColor);
    let contrastRatio = (Math.max(lum1, lum2) + 0.05) / (Math.min(lum1, lum2) + 0.05);
    stats.minCR = Math.min(stats.minCR, contrastRatio);
    stats.maxCR = Math.max(stats.maxCR, contrastRatio);
    (contrastRatio < passingAAContrastForLayer) ? ++stats.aaFail : ++stats.aaPass;
    (contrastRatio < passingAAAContrastForLayer) ? ++stats.aaaFail : ++stats.aaaPass;
  }

  return {
    aa: detailFor(stats.aaFail, stats.aaPass, stats.minCR, stats.maxCR),
    aaa: detailFor(stats.aaaFail, stats.aaaPass, stats.minCR, stats.maxCR),
  };
}


function detailFor(numFail, numPass, minCR, maxCR): ContrastResultDetail {
  if (numFail > 0 && numPass > 0) {
    return {
      status: 'mixed',
      contrastRatio: minCR,
      note: formatContrastRatio(minCR) + ' - ' + formatContrastRatio(maxCR),
    };
  } else if (numFail > 0) {
    return { status: 'fail', contrastRatio: minCR };
  } else if (numPass > 0) {
    return { status: 'pass', contrastRatio: minCR };
  } else {
    return { status: 'unknown', contrastRatio: 0 };
  }
}



/**
 * Takes a number like 5.561236 and formats it as a contrast ratio like 5.57:1
 */
export function formatContrastRatio(contrastRatio) {
  return isNaN(contrastRatio) ? 'NA' : contrastRatio.toFixed(2) + ':1';
}