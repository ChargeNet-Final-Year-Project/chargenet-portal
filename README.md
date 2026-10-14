# ChargeNet management portal

React 18 / TypeScript / Vite console for simulated CPO onboarding, integration,
network monitoring, original-currency CDRs, revenue and administrator governance.
It communicates with `chargenet-backend` over `/admin/api` and builds independently.

## Setup

Use Node.js 22 and npm. Start the backend on port 8080 with
`PORTAL_ORIGIN=http://localhost:5173`, then:

```sh
npm ci
# Optional: copy .env.example to .env and set VITE_API_BASE_URL.
npm run dev
```

Open `http://localhost:5173`. `VITE_API_BASE_URL` defaults to
`http://localhost:8080`. Do not put private credentials in VITE variables: Vite
embeds them in client bundles. Private `.env*` files are excluded from Git.

## Demonstration accounts

The backend seeds `admin@chargenet.my` / `Admin1234!` and operator accounts
`ops@voltgo.my`, `ops@chargesync.my`, `ops@ecowatt.my` with `Cpo1234!`.
These are public development fixtures.

CPO registration begins pending. Configure/verify the OCPI connection, then obtain
administrator approval. Marketplace access requires both steps. Operator
network/CDR access is tenant-scoped; administrator routes require the separate
SUPER_ADMIN role.

## Verify and build

```sh
npm run typecheck
npm run build
npm run preview
```

TypeScript checking and the Vite build are the repository's automated checks.
No browser-test framework is currently configured. The backend repository covers
portal API authorization, tenancy, reporting boundaries and exports. Use a
manual browser walkthrough to check the complete operator workflow.

## Structure

`src/App.tsx` defines routes and role gates; `src/api.ts` owns authenticated fetch;
`src/auth` restores the cookie session; `src/pages` contains workflow screens;
`src/ui` holds shared controls, formatting, reporting and sandbox trace behavior.
`src/app.css` supplies the light operational theme.

See [operations](docs/OPERATIONS.md).

## Development

ChargeNet uses rapid prototyping. Each increment starts on a short branch from
`main`, uses focused commits, and is merged with a merge commit after the relevant
checks pass. Shared increments use the same branch name in each repository they
change. Repositories unaffected by an increment receive no branch or commit.
