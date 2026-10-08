// Keep these DTOs in sync with the backend portal and authentication responses.

export type Role = 'CPO' | 'SUPER_ADMIN';

export interface PortalUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  cpoId?: string;
}

export type CPOStatus = 'PENDING' | 'ACTIVE' | 'SUSPENDED';
export type HandshakeStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'VERIFIED' | 'FAILED';
export type PayoutCycle = 'WEEKLY' | 'MONTHLY';

export interface CPOProfile {
  ocpiVersion?: string;
  id: string;
  name: string;
  slug: string;
  countryCode: string;
  partyId: string;
  baseUrl: string;
  colorHex: string;
  contactEmail: string;
  tokenA: string;
  tokenAUsed: boolean;
  tokenBSet: boolean;
  tokenCSet: boolean;
  tokenBLast4: string;
  tokenCLast4: string;
  handshakeStatus: HandshakeStatus;
  status: CPOStatus;
  platformFeePct: number;
  bankName: string;
  bankAccountHolder: string;
  bankAccountNo: string;
  payoutCycle: PayoutCycle;
  createdAt: string;
  handshakeAt: string | null;
}

export interface Connector {
  currency: string;
  id: string;
  stationId?: string;
  evseUid: string;
  standard: string;
  format: string;
  powerType: string;
  maxPowerKw: number;
  tariffPerKwh: number;
  status: string;
}

export interface PortalStation {
  countryCode: string;
  isSimulated: boolean;
  id: string;
  name: string;
  address: string;
  city: string;
  latitude: number;
  longitude: number;
  totalBays: number;
  availableBays: number;
  connectors: Connector[];
}

export interface ConnectorCounts {
  available: number;
  charging: number;
  blocked: number;
  inoperative: number;
}

export interface NetworkView {
  stations: PortalStation[];
  counts: ConnectorCounts;
  sessionsToday: number;
}

export interface DailyPoint {
  day: string;
  sessions: number;
  gross: number;
}

export interface Overview {
  currency: string;
  sessionsToday: number;
  kwhToday: number;
  grossToday: number;
  activeSessions: number;
  netPayoutMtd: number;
  counts: ConnectorCounts;
  last7Days: DailyPoint[];
}

export interface LedgerTotals {
  currency: string;
  count: number;
  energyKwh: number;
  gross: number;
  platformFee: number;
  netPayout: number;
}

export interface LedgerRow {
  id: string;
  sessionId: string;
  startTime: string;
  endTime: string;
  stationName: string;
  evseUid: string;
  energyKwh: number;
  minutes: number;
  tariffPerKwh: number;
  gross: number;
  platformFee: number;
  netPayout: number;
  currency: string;
}

export interface LedgerResponse {
  from: string;
  to: string;
  page: number;
  limit: number;
  evseUid: string;
  rows: LedgerRow[];
  totals: LedgerTotals;
}

export interface PortalCDR {
  row: LedgerRow;
  document: Record<string, unknown>;
}

export interface HandshakeStep {
  step: number;
  label: string;
  status: string;
  detail?: string;
  durationMs?: number;
}

export interface HandshakeResult {
  status: string;
  steps: HandshakeStep[];
}

export interface AdminCPO {
  currency: string;
  id: string;
  name: string;
  partyId: string;
  status: string;
  handshakeStatus: string;
  stations: number;
  evses: number;
  sessionsToday: number;
  grossToday: number;
  platformFeePct: number;
}

export interface AdminOverview {
  currency: string;
  cpos: number;
  activeCpos: number;
  stations: number;
  evses: number;
  sessionsToday: number;
  grossToday: number;
  last7Days: DailyPoint[];
}
