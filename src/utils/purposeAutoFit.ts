/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface PurposeFitResult {
  fontSize: number; // 11, 10, 9, 8, 7, 6 (pt)
  weightedLength: number;
  state: "NORMAL" | "SCALED" | "OVERFLOW";
  statusText: string;
  isOverflow: boolean;
  recommendedFontPt: number;
}

export interface PoFitResult {
  fontSize: number;
  length: number;
}

/**
 * Enterprise Auto-Fit Algorithm for PIS PO Number Field
 *
 * Cell A15:D15 in PIS_TEMPLATE.xlsm fits ~11-12 standard character width units at 11pt default Tahoma font.
 */
export function computePoFit(poNumber: string): PoFitResult {
  const text = (poNumber || "").trim();
  const length = text.length;
  if (length <= 11) {
    return { fontSize: 11, length };
  } else if (length <= 13) {
    return { fontSize: 10, length };
  } else if (length <= 15) {
    return { fontSize: 8, length };
  } else if (length <= 18) {
    return { fontSize: 7, length };
  } else {
    return { fontSize: 6, length };
  }
}

/**
 * Enterprise Auto-Fit Algorithm for PIS Purpose Field
 *
 * Cell E15:J15 in PIS_TEMPLATE.xlsm fits ~28-30 standard character width units at 11pt default Tahoma font.
 * This algorithm calculates the proportional weighted width of characters ('W' vs 'i')
 * and determines progressive font scaling so the text fits cleanly inside the cell:
 * - Fits normally: 11 pt (<= 28 weighted units)
 * - Slight scaling: 10 pt (29 - 34 weighted units)
 * - Moderate scaling: 9 pt (35 - 40 weighted units)
 * - Significant scaling: 8 pt (41 - 47 weighted units)
 * - Heavy scaling: 7 pt (48 - 58 weighted units)
 * - Maximum scaling / overflow: 6 pt (>= 59 weighted units)
 */
export function computePurposeFit(text: string): PurposeFitResult {
  if (!text) {
    return {
      fontSize: 11,
      weightedLength: 0,
      state: "NORMAL",
      statusText: "0 / Safe Width (11 pt)",
      isOverflow: false,
      recommendedFontPt: 11
    };
  }

  // Calculate weighted character width to handle proportional fonts ('W' vs 'i')
  let weightedLength = 0;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if ("WMWmw@%#".includes(char)) {
      weightedLength += 1.35;
    } else if ("ili1Ijtfr .,;:!'|()-".includes(char)) {
      weightedLength += 0.45;
    } else if ("ABCDEFGHJKLNOPQRSTUVXYZ023456789".includes(char)) {
      weightedLength += 0.95;
    } else {
      weightedLength += 0.85;
    }
  }

  const roundedUnits = Math.round(weightedLength);

  if (weightedLength <= 28) {
    return {
      fontSize: 11,
      weightedLength,
      state: "NORMAL",
      statusText: `${roundedUnits} / Safe Width (11 pt)`,
      isOverflow: false,
      recommendedFontPt: 11
    };
  } else if (weightedLength <= 34) {
    return {
      fontSize: 10,
      weightedLength,
      state: "SCALED",
      statusText: `Beyond recommended width — Font automatically scaled to 10 pt for Excel export.`,
      isOverflow: false,
      recommendedFontPt: 10
    };
  } else if (weightedLength <= 40) {
    return {
      fontSize: 9,
      weightedLength,
      state: "SCALED",
      statusText: `Beyond recommended width — Font automatically scaled to 9 pt for Excel export.`,
      isOverflow: false,
      recommendedFontPt: 9
    };
  } else if (weightedLength <= 47) {
    return {
      fontSize: 8,
      weightedLength,
      state: "SCALED",
      statusText: `Beyond recommended width — Font automatically scaled to 8 pt for Excel export.`,
      isOverflow: false,
      recommendedFontPt: 8
    };
  } else if (weightedLength <= 58) {
    return {
      fontSize: 7,
      weightedLength,
      state: "SCALED",
      statusText: `Beyond recommended width — Font automatically scaled to 7 pt for Excel export.`,
      isOverflow: false,
      recommendedFontPt: 7
    };
  } else {
    return {
      fontSize: 6,
      weightedLength,
      state: "OVERFLOW",
      statusText: `⚠ Purpose exceeds the printable area. Please shorten description for optimal readability.`,
      isOverflow: true,
      recommendedFontPt: 6
    };
  }
}
