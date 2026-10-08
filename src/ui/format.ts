export const money = (n: number | null | undefined, currency = 'MYR'): string =>
  new Intl.NumberFormat('en', { style: 'currency', currency, currencyDisplay: 'code', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(n ?? 0));

export const num = (n: number | null | undefined, dp = 0): string =>
  Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: dp, maximumFractionDigits: dp });

export const kwh = (n: number | null | undefined): string => Number(n || 0).toFixed(2) + ' kWh';

export const pct = (n: number | null | undefined): string => Number(n || 0).toFixed(2) + ' %';

function asDate(v: string | Date): Date {
  return v instanceof Date ? v : new Date(v);
}

export const REPORTING_TIMEZONE = 'Asia/Kuala_Lumpur';

export const fmtDate = (v: string | Date | null | undefined): string => {
  const d = asDate(v as string | Date);
  return isNaN(d.getTime())
    ? '—'
    : d.toLocaleDateString(undefined, { timeZone: REPORTING_TIMEZONE, year: 'numeric', month: 'short', day: '2-digit' });
};

export const fmtTime = (v: string | Date | null | undefined): string => {
  const d = asDate(v as string | Date);
  return isNaN(d.getTime())
    ? '—'
    : d.toLocaleTimeString(undefined, { timeZone: REPORTING_TIMEZONE, hour: '2-digit', minute: '2-digit' });
};

export const fmtDateTime = (v: string | Date | null | undefined): string => {
  const d = asDate(v as string | Date);
  return isNaN(d.getTime()) ? '—' : fmtDate(d) + ' ' + fmtTime(d);
};

export const dayKey = (d: Date): string => {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: REPORTING_TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(d);
  const part = (type: string) => parts.find(p => p.type === type)!.value;
  return `${part('year')}-${part('month')}-${part('day')}`;
};

/** Calendar labels arrive as YYYY-MM-DD; do not shift them through a timezone. */
export function chartDay(day: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
  if (!match) return day;
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${Number(match[3])} ${months[Number(match[2]) - 1] ?? match[2]}`;
}

/** Energy unit prices keep their contractual precision. */
export const tariff = (n: number,currency = 'MYR'): string =>
  new Intl.NumberFormat('en',{style:'currency',currency,currencyDisplay:'code',minimumFractionDigits:2,maximumFractionDigits:6}).format(n);
