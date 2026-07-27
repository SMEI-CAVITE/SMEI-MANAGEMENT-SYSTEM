export const MANIFEST_REGEX = /^[mM]-[a-zA-Z0-9]+-\d{4}-\d{2}-\d+$/;

/**
 * Validates whether a manifest number matches the format M-[REGION]-[YEAR]-[MONTH]-[NUMBER]
 */
export function validateManifestNumber(val: string): boolean {
  return MANIFEST_REGEX.test(val);
}

/**
 * Generates a compliant manifest number dynamically based on a region code
 */
export function generateManifestNumber(region: string = "R3"): string {
  const cleanRegion = region.trim().toUpperCase() || "R3";
  const year = new Date().getFullYear();
  const month = String(new Date().getMonth() + 1).padStart(2, "0");
  const rand = Math.floor(100000 + Math.random() * 900000); // 6-digit random number
  return `M-${cleanRegion}-${year}-${month}-${rand}`;
}
