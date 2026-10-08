export type IconName = 'overview' | 'network' | 'revenue' | 'key' | 'company' | 'sandbox' | 'partners' | 'menu';
const paths: Record<IconName, string> = {
  overview: 'M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z',
  network: 'M12 8V4 M5 16v-4h14v4 M12 12V8 M9 2h6v6H9z M2 16h6v6H2z M16 16h6v6h-6z',
  revenue: 'M4 3v18h16 M8 16v-4 M13 16V8 M18 16V5',
  key: 'M14 10a5 5 0 1 0-4 4l3 3h3v3h4v-4l-6-6z',
  company: 'M4 21V3h11v18 M15 9h5v12 M8 7h3 M8 11h3 M8 15h3 M2 21h20',
  sandbox: 'M8 5 2 12l6 7 M16 5l6 7-6 7 M14 3l-4 18',
  partners: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M15 3a4 4 0 0 1 0 8 M22 21v-2a4 4 0 0 0-3-3.87 M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0z',
  menu: 'M3 6h18 M3 12h18 M3 18h18',
};
export function Icon({ name }: { name: IconName }) {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name]} /></svg>;
}
