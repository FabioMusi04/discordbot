export function parseDuration(duration: string): number | null {
  if (duration.toLowerCase() === "perm") return null;
  
  const match = duration.match(/(\d+)([hmd])/);

  if (!match || !match[1]) return null;

  const value = parseInt(match[1], 10);
  const unit = match[2];
  
  switch (unit) {
    case 'h': return value * 60 * 60 * 1000;
    case 'd': return value * 24 * 60 * 60 * 1000;
    case 'm': return value * 60 * 1000;
    default: return null;
  }
}
