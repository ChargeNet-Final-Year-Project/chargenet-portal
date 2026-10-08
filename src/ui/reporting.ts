import { dayKey } from './format';

/** Calendar arithmetic uses day strings; UTC here is only a neutral date carrier. */
function shift(day: string, days: number): string {
  const date = new Date(day + 'T00:00:00Z');
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function rangeFor(key: string, now = new Date()): { from: string; to: string } {
  const to = dayKey(now);
  const from = key === '7d' ? shift(to, -6) : key === '30d' ? shift(to, -29) : key === 'mtd' ? to.slice(0, 7) + '-01' : to;
  return { from, to };
}

export function cycleFor(cycle: string, now = new Date()) {
  const to = dayKey(now);
  if (cycle === 'WEEKLY') {
    const weekday = new Date(to + 'T00:00:00Z').getUTCDay() || 7;
    const from = shift(to, 1 - weekday);
    return { from, to, next: shift(from, 7) };
  }
  const from = to.slice(0, 7) + '-01';
  const next = new Date(from + 'T00:00:00Z');
  next.setUTCMonth(next.getUTCMonth() + 1);
  return { from, to, next: next.toISOString().slice(0, 10) };
}

export function validRange(from: string, to: string): boolean {
  const valid = (day: string) => /^\d{4}-\d{2}-\d{2}$/.test(day) && !isNaN(Date.parse(day)) && new Date(day).toISOString().slice(0, 10) === day;
  return valid(from) && valid(to) && from <= to;
}
