// Explicit allowlist: never copy frames, eye features, model weights, URLs or device IDs.
const number = value => Number.isFinite(value) ? Math.round(value * 10000) / 10000 : null;
const count = value => Number.isInteger(value) && value >= 0 ? value : null;
export function calibrationSummary(result, reports = []) {
  return {
    schema: 'gaze-reader-calibration-summary-v1',
    passed: result.ok === true,
    meanError: number(result.meanError), maxError: number(result.maxError),
    regionAgreement: ['up', 'neutral', 'down'].map((region, index) => ({region, ratio: number(result.regions?.[index])})),
    validationPoints: (result.points || []).map(point => ({
      target: {x: number(point.target?.x), y: number(point.target?.y)},
      samples: count(point.count), meanError: number(point.meanError),
      maxError: number(point.maxError), agreement: number(point.coverage)
    })),
    trainingPoints: reports.map(report => ({samples: count(report.count), accepted: count(report.kept)}))
  };
}
export function formatCalibrationSummary(result, reports) {
  return JSON.stringify(calibrationSummary(result, reports), null, 2);
}
