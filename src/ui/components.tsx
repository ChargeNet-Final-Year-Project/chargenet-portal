import { ReactNode, ReactElement, Children, cloneElement, isValidElement, useId, useEffect, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { money, chartDay } from './format';

// Badge

const BADGE: Record<string, string> = {
  AVAILABLE: 'available',
  CHARGING: 'charging',
  BLOCKED: 'blocked',
  INOPERATIVE: 'inoperative',
  ACTIVE: 'active',
  PENDING: 'pending',
  SUSPENDED: 'suspended',
  VERIFIED: 'verified',
  FAILED: 'failed',
  IN_PROGRESS: 'in-progress',
  NOT_STARTED: 'not-started',
  PASS: 'pass',
  FAIL: 'fail',
  SKIPPED: 'skipped',
};

const cls = (s: string): string => BADGE[s.toUpperCase().replace(/-/g, '_')] || 'neutral';

export function Badge({ text, kind }: { text: string; kind?: string }) {
  return <span className={'badge ' + cls(kind ?? text)}>{text}</span>;
}

// Fields and forms

export function Field({ label, hint, error, required, children }: { label?: string; hint?: string; error?: string; required?: boolean; children: ReactNode }) {
  const generated = useId();
  const controlId = 'field-' + generated;
  const container = useRef<HTMLDivElement>(null);
  let associated = false;
  let labelId = controlId;
  function associate(nodes: ReactNode): ReactNode {
    return Children.map(nodes, node => {
      if (!isValidElement(node) || typeof node.type !== 'string') return node;
      const element = node as ReactElement<{ id?: string; children?: ReactNode; required?: boolean; 'aria-describedby'?: string }>;
      if (!associated && ['input', 'select', 'textarea'].includes(String(element.type))) {
        associated = true;
        labelId = element.props.id || controlId;
        const described = [element.props['aria-describedby'], hint ? controlId + '-hint' : '', error ? controlId + '-error' : ''].filter(Boolean).join(' ');
        return cloneElement(element, { id: labelId, required: required ?? element.props.required,
          'aria-describedby': described || undefined, 'aria-invalid': error ? true : undefined } as Record<string, unknown>);
      }
      return element.props.children ? cloneElement(element, {}, associate(element.props.children)) : element;
    });
  }
  const controls = associate(children);
  useEffect(() => {
    if (!error) return;
    const frame = requestAnimationFrame(() => {
      const form = container.current?.closest('form');
      const first = form?.querySelector<HTMLElement>('[aria-invalid="true"]') ?? container.current?.querySelector<HTMLElement>('[aria-invalid="true"]');
      first?.focus();
    });
    return () => cancelAnimationFrame(frame);
  }, [error]);
  return <div ref={container} className={'field' + (error ? ' invalid' : '')}>
    {label ? <label htmlFor={labelId}>{label}{required ? ' (required)' : ''}</label> : null}
    {controls}
    {hint ? <div id={controlId + '-hint'} className="hint">{hint}</div> : null}
    {error ? <div id={controlId + '-error'} className="err">{error}</div> : null}
  </div>;
}

export function FormError({ message }: { message: string | null }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!message) return;
    const frame = requestAnimationFrame(() => {
      if (!ref.current?.closest('form')?.querySelector('[aria-invalid="true"]')) ref.current?.focus();
    });
    return () => cancelAnimationFrame(frame);
  }, [message]);
  return message ? <div ref={ref} role="alert" tabIndex={-1} className="form-msg error">{message}</div> : null;
}

export function LoadNotice({ loading, error, hasData, updatedAt, onRetry, label = 'data' }: { loading: boolean; error: string | null; hasData: boolean; updatedAt?: Date | null; onRetry: () => void; label?: string }) {
  if (!loading && !error) return null;
  return <div className={'banner ' + (loading ? 'info' : error ? 'err' : 'info')} role={loading ? 'status' : error ? 'alert' : 'status'}>
    <div className="grow">{loading ? `${hasData ? 'Updating' : 'Loading'} ${label}…` : `Could not refresh ${label}. ${error}`}
      {hasData ? <div className="small">Showing last successful data{updatedAt ? ' from ' + updatedAt.toLocaleTimeString() : ''}.</div> : null}
    </div>
    {error ? <button className="btn btn-sm" type="button" disabled={loading} onClick={onRetry}>Retry</button> : null}
  </div>;
}

export function DetailLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="spread small detail-line">
      <span className="muted">{label}</span>
      <span>{value || '—'}</span>
    </div>
  );
}

export function Kpi({ label, value, sub }: { label: string; value: ReactNode; sub?: ReactNode }) {
  return (
    <div className="kpi">
      <div className="label">{label}</div>
      <div className="value">{value}</div>
      {sub ? <div className="sub">{sub}</div> : null}
    </div>
  );
}

export function SummaryItem({ label, value }: { label: string; value: ReactNode }) {
  return <div className="summary-item"><dt>{label}</dt><dd>{value}</dd></div>;
}

// The table exposes exact values that the visual chart cannot convey.
export interface BarPoint { label: string; value: number }

export function BarChart({ points, color = 'var(--brand)', height, currency = 'MYR' }: { points: BarPoint[]; color?: string; height?: number; currency?: string }) {
  const maximum = Math.max(0, ...points.map(p => p.value));
  const roughStep = maximum / 4 || 1;
  const magnitude = 10 ** Math.floor(Math.log10(roughStep));
  const step = ([1, 2, 2.5, 5, 10].find(n => n >= roughStep / magnitude) ?? 10) * magnitude;
  const ceiling = step * 4;
  const axis = new Intl.NumberFormat('en-MY', { maximumFractionDigits: Math.max(0, Math.min(6, -Math.floor(Math.log10(step)) + 1)) });
  const columns = { gridTemplateColumns: `repeat(${Math.max(1, points.length)}, minmax(0, 1fr))` };
  return <figure className="revenue-chart">
    <figcaption className="muted small">Gross revenue ({currency})</figcaption>
    {maximum > 0 ? <div className="chart-frame" aria-hidden="true">
      <div className="chart-axis">{[4, 3, 2, 1, 0].map(n => <span key={n}>{axis.format(n * step)}</span>)}</div>
      <div className="chart-plot" style={height ? { height } : undefined}>
        {[0, 25, 50, 75, 100].map(n => <div key={n} className="chart-gridline" style={{ bottom: `${n}%` }} />)}
        <div className="chart-columns" style={columns}>{points.map((p, i) => <div key={i} className="chart-column">
          {p.value > 0 ? <div className="revenue-bar" style={{ height: `${p.value / ceiling * 100}%`, background: color }} /> : null}
        </div>)}</div>
      </div>
      <div className="chart-dates" style={columns}>{points.map((p, i) => <span key={i}>{chartDay(p.label).replace(' ', '\n')}</span>)}</div>
    </div> : <p className="chart-empty">{points.length ? 'No settled revenue in these seven days.' : 'No daily revenue data available.'}</p>}
    {points.length > 0 ? <details className="chart-data"><summary>View daily revenue</summary>
      <table className="table"><caption className="sr-only">Daily gross revenue in {currency}</caption>
        <thead><tr><th scope="col">Date</th><th scope="col" className="numeric">Gross ({currency})</th></tr></thead>
        <tbody>{points.map((p, i) => <tr key={i}><th scope="row">{p.label}</th><td className="numeric">{money(p.value,currency)}</td></tr>)}</tbody>
      </table>
    </details> : null}
  </figure>;
}

export interface DonutDatum {
  label: string;
  value: number;
  color: string;
}

export function Donut({ data, size = 160 }: { data: DonutDatum[]; size?: number }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  const r = 60;
  const cx = 80;
  const cy = 80;
  const c = 2 * Math.PI * r;
  let offset = 0;

  const segs = data.map((d, i) => {
    const frac = total ? d.value / total : 0;
    const len = frac * c;
    const seg = (
      <circle
        key={i}
        cx={cx}
        cy={cy}
        r={r}
        fill="none"
        stroke={d.color}
        strokeWidth="18"
        strokeDasharray={`${len.toFixed(2)} ${(c - len).toFixed(2)}`}
        strokeDashoffset={(-offset).toFixed(2)}
        transform={`rotate(-90 ${cx} ${cy})`}
      >
        <title>
          {d.label}: {d.value}
        </title>
      </circle>
    );
    offset += len;
    return seg;
  });

  return (
    <svg width={size} height={size} viewBox="0 0 160 160" role="img" aria-label="connectors by status">
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--surface-2)" strokeWidth="18" />
      {segs}
      <text x={cx} y={cy + 5} textAnchor="middle" fontSize="20" fontWeight="700" fill="var(--text)">
        {total}
      </text>
    </svg>
  );
}

// Modal

export interface ModalProps {
  title?: string;
  wide?: boolean;
  onClose: () => void;
  footer?: ReactNode;
  children: ReactNode;
  returnFocusTo?: HTMLElement | null;
}

let openOverlays = 0;
let previousOverflow = '';

/** Native dialogs provide tab containment and an inert background. */
function useOverlay(onClose: () => void, returnFocusTo?: HTMLElement | null) {
  const ref = useRef<HTMLDialogElement>(null);
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const dialog = ref.current!;
    const trigger = returnFocusTo ?? (document.activeElement instanceof HTMLElement ? document.activeElement : null);
    if (openOverlays++ === 0) { previousOverflow = document.body.style.overflow; document.body.style.overflow = 'hidden'; }
    dialog.showModal();
    (dialog.querySelector<HTMLElement>('input:not([disabled]), select:not([disabled]), textarea:not([disabled])') ?? dialog.querySelector<HTMLElement>('button:not([disabled])'))?.focus();
    const cancel = (event: Event) => { event.preventDefault(); close.current(); };
    const containTab = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return;
      const stops = [...dialog.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], summary, [tabindex="0"]')].filter(el => el.getClientRects().length);
      const first = stops[0], last = stops[stops.length - 1];
      if (!first) { event.preventDefault(); dialog.focus(); }
      else if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    dialog.addEventListener('cancel', cancel);
    dialog.addEventListener('keydown', containTab);
    return () => {
      dialog.removeEventListener('cancel', cancel);
      dialog.removeEventListener('keydown', containTab);
      dialog.close();
      if (--openOverlays === 0) document.body.style.overflow = previousOverflow;
      // Wait for a cancelling caller to re-enable its trigger.
      requestAnimationFrame(() => { if (trigger?.isConnected) trigger.focus(); });
    };
  }, []);
  return ref;
}

export function Modal({ title, wide, onClose, footer, children, returnFocusTo }: ModalProps) {
  const titleId = useId();
  const ref = useOverlay(onClose, returnFocusTo);
  return createPortal(
    <dialog ref={ref} className="overlay" aria-labelledby={titleId} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={'modal' + (wide ? ' wide' : '')}>
        <div className="modal-head"><h2 id={titleId}>{title ?? 'Confirm action'}</h2>
          <button className="btn btn-ghost btn-sm" type="button" aria-label="Close" onClick={onClose}>Close</button>
        </div>
        <div className="modal-body">{children}</div>
        {footer ? <div className="modal-foot">{footer}</div> : null}
      </div>
    </dialog>, document.body);
}

export function Drawer({ onClose, children }: { onClose: () => void; children: ReactNode }) {
  const ref = useOverlay(onClose);
  return createPortal(
    <dialog ref={ref} className="drawer-dialog" aria-label="EVSE details" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <aside className="drawer">{children}</aside>
    </dialog>, document.body);
}

// Confirm dialog

interface ConfirmOptions {
  title?: string;
  confirmLabel?: string;
  danger?: boolean;
}

interface ConfirmRequest extends ConfirmOptions {
  message: string;
  resolve: (v: boolean) => void;
  trigger: HTMLElement | null;
}

export function useConfirm() {
  const [req, setReq] = useState<ConfirmRequest | null>(null);
  const pending = useRef<ConfirmRequest | null>(null);
  useEffect(() => () => { pending.current?.resolve(false); pending.current = null; }, []);

  const confirm = useCallback((message: string, opts: ConfirmOptions = {}) => {
    return new Promise<boolean>((resolve) => {
      pending.current?.resolve(false);
      pending.current = { message, resolve, ...opts, trigger: document.activeElement instanceof HTMLElement ? document.activeElement : null };
      setReq(pending.current);
    });
  }, []);

  const close = useCallback(
    (value: boolean) => {
      pending.current?.resolve(value);
      pending.current = null;
      setReq(null);
    },
    [],
  );

  const dialog = req ? (
    <Modal
      title={req.title ?? 'Are you sure?'}
      returnFocusTo={req.trigger}
      onClose={() => close(false)}
      footer={
        <>
          <button className="btn" onClick={() => close(false)}>
            Cancel
          </button>
          <button
            className={'btn ' + (req.danger ? 'btn-danger' : 'btn-primary')}
            onClick={() => close(true)}
          >
            {req.confirmLabel ?? 'Confirm'}
          </button>
        </>
      }
    >
      <p>{req.message}</p>
    </Modal>
  ) : null;

  return { confirm, dialog };
}
