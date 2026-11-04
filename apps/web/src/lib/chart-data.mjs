export function connectForecastSeries(points = []) {
  const lastActualIndex = points.findLastIndex((point) => Number.isFinite(point.actual));
  if (lastActualIndex < 0) return points;

  const hasFutureForecast = points
    .slice(lastActualIndex + 1)
    .some((point) => Number.isFinite(point.forecast));
  if (!hasFutureForecast || Number.isFinite(points[lastActualIndex]?.forecast)) return points;

  return points.map((point, index) => index === lastActualIndex
    ? {
        ...point,
        forecast: point.actual,
        lower: point.actual,
        upper: point.actual,
        forecastBridge: true,
      }
    : point);
}
