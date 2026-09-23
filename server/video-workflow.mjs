export function findVideoOutput(outputs) {
  for (const value of Object.values(outputs || {})) {
    if (value && typeof value === 'object') {
      if (typeof value.filename === 'string' && /\.(mp4|webm)$/i.test(value.filename) && value.type === 'output') return value;
      const nested = findVideoOutput(value); if (nested) return nested;
    }
  }
  return null;
}
