import { useState } from 'react';
import { CurrencyFilter } from '../ui/CurrencyFilter';
import { Link } from 'react-router-dom';
import { useResource } from '../ui/useResource';
import { BarChart, SummaryItem, BarPoint, LoadNotice } from '../ui/components';
import { money, num, kwh } from '../ui/format';
import { Overview as OverviewData } from '../types';

export default function Overview() {
  const [currency,setCurrency]=useState('MYR');
  const resource = useResource<OverviewData>('/admin/api/overview?currency='+currency);
  const data = resource.data;
  const notice = <LoadNotice {...resource} hasData={!!data} onRetry={() => void resource.refresh()} label="overview" />;
  if (!data) return <div className="stack"><h1>Overview</h1>{notice}</div>;

  const counts = data.counts || { available: 0, charging: 0, blocked: 0, inoperative: 0 };
  const points: BarPoint[] = (data.last7Days || []).map((d) => ({
    label: String(d.day),
    value: Math.round((d.gross || 0) * 100) / 100,
  }));
  const statuses = [
    { label: 'Available', value: counts.available || 0, color: 'var(--green)' },
    { label: 'Charging', value: counts.charging || 0, color: 'var(--blue)' },
    { label: 'Blocked', value: counts.blocked || 0, color: 'var(--amber)' },
    { label: 'Inoperative', value: counts.inoperative || 0, color: 'var(--red)' },
  ];

  const totalBays = statuses.reduce((sum, status) => sum + status.value, 0);
  return (
    <div className="stack">
      <h1>Overview</h1>
      <CurrencyFilter value={currency} onChange={setCurrency} />
      {notice}
      <section className="card" aria-labelledby="network-summary">
        <div className="card-head"><h2 id="network-summary">Network status</h2><Link className="btn btn-sm" to="/network">View stations</Link></div>
        <p className="muted small">{num(totalBays)} bays · {num(data.activeSessions)} active sessions</p>
        {totalBays > 0 ? <div className="status-track" aria-hidden="true">{statuses.map(s => <span key={s.label} style={{ flexGrow: s.value, background: s.color }} />)}</div> : null}
        <dl className="summary-strip status-summary">{statuses.map(s => <SummaryItem key={s.label} label={s.label} value={num(s.value)} />)}</dl>
      </section>
      <dl className="summary-strip" aria-label="Today">
        <SummaryItem label="Sessions today" value={num(data.sessionsToday)} />
        <SummaryItem label="Energy today" value={kwh(data.kwhToday)} />
        <SummaryItem label="Gross today" value={money(data.grossToday,data.currency)} />
        <SummaryItem label="Net payout this month" value={money(data.netPayoutMtd,data.currency)} />
      </dl>
      <section className="card" aria-labelledby="revenue-summary">
        <div className="card-head"><h2 id="revenue-summary">Last 7 days</h2><Link className="btn btn-sm" to="/ledger">View revenue</Link></div>
        <BarChart points={points} currency={data.currency} />
      </section>
    </div>
  );
}
