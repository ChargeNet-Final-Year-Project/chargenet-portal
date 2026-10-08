export interface TraceEntry {
  at: string; ok: boolean; note?: string; request: unknown; response: unknown;
  kind?: 'command' | 'observation'; outcome?: 'changed' | 'unchanged' | 'error';
}
let owner = '';
let entries: TraceEntry[] = [];
export function clearSandboxTrace() { owner = ''; entries = []; }
export function readSandboxTrace(userId: string) {
  if (owner !== userId) { owner = userId; entries = []; }
  return [...entries];
}
export function appendSandboxTrace(userId: string, entry: TraceEntry) {
  if (owner !== userId) return null;
  entries = [entry, ...entries].slice(0, 100);
  return [...entries];
}
