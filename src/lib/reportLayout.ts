/** Scale factor (0.55..1) so the front side fits one A4 (usable height about 283 mm). */
export function reportScale(tableRows: number): number {
  const estimateMm = 218 + tableRows * 3.6
  return Math.max(0.55, Math.min(1, 272 / estimateMm))
}
