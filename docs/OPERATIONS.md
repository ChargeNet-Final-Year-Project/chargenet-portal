# Operator and administrator workflows

Authentication uses the backend's HttpOnly `cn_portal` cookie. The fetch wrapper
sends credentials, and PORTAL_ORIGIN must match the portal origin. CORS controls
allowed origins. The backend enforces roles and tenant access.

Operators can register, manage company data, reveal/copy an unused Token A,
configure endpoints, verify/disconnect credentials, monitor their network and
inspect their own CDRs. Tokens B/C are masked hints; full operational values do
not enter the browser. Marketplace access requires connection verification and
administrator approval. Administrators also suspend operators and set platform
fees.

Revenue aggregates use one source currency at a time and user-confirmed
Asia/Kuala_Lumpur business-day boundaries. CSV exports contain the complete
matching range, although the UI list is paginated. Sandbox sessions are excluded
from revenue. Payout and cycle estimates are simulated records and never initiate
bank transfers.

Sandbox traces show accepted requests and responses, followed by later network
observations from polling. They clear on logout. Failed refreshes keep the last
good data visible with retry and freshness feedback.
