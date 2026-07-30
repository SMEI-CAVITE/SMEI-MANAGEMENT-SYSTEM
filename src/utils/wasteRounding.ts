/**
 * Calculates the recovered quantity according to official Excel Hazardous Waste Breakdown rules:
 * - When percentage >= 100% (e.g., 100%), preserve exact quantity without rounding (e.g. 166.50 -> 166.50).
 * - When percentage < 100%, compute (qty * percentage / 100) and round to nearest integer using standard Excel ROUND(x, 0).
 */
export function computeRecoveryValue(qty: number, percentage: number): number {
  const qtyVal = Number(qty) || 0;
  const pctVal = Number(percentage) || 0;
  if (qtyVal <= 0 || pctVal <= 0) return 0;

  if (pctVal >= 100) {
    return qtyVal; // Preserve exact decimal quantity for 100% recovery
  }

  const rawRecovered = qtyVal * (pctVal / 100);
  return Math.round(Number(rawRecovered.toFixed(6)));
}

/**
 * Legacy / general business rounding helper.
 * Accepts optional percentage to delegate to computeRecoveryValue, or applies standard rounding.
 */
export function applyBusinessRounding(val: number, percentage?: number): number {
  if (percentage !== undefined) {
    return computeRecoveryValue(val, percentage);
  }
  if (!val || isNaN(val) || val <= 0) return 0;
  return Math.round(Number(val.toFixed(6)));
}

