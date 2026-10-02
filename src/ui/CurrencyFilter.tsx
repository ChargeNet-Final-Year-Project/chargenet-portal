export function CurrencyFilter({ value, onChange }: { value: string; onChange: (currency: string) => void }) {
  return <div className="row wrap">
    <label htmlFor="report-currency" className="muted small">Revenue currency</label>
    <select id="report-currency" className="select" style={{ maxWidth: '23rem' }} value={value} onChange={e => onChange(e.target.value)}>
      <option value="MYR">MYR · Malaysian ringgit</option>
      <option value="SGD">SGD · Singapore dollar</option>
      <option value="THB">THB · Thai baht</option>
    </select>
    <span className="muted small">Original tariff currency. Currencies are reported separately.</span>
  </div>;
}
