# SocietyLedger Architecture & Implementation Specification

This document details the full-stack architecture, database models, security controls, and design system implemented in **SocietyLedger**.

---

## 1. System Topology & Integrated Architecture

SocietyLedger is built as an integrated MERN platform (MongoDB, Express, React, Node.js) with independent, decoupled execution layers:

```
SocietyLedger/
├── backend/                       # Node.js + Express API server (Port 5000)
│   ├── src/
│   │   ├── config/db.js           # Mongoose connection with lifecycle hooks
│   │   ├── controllers/           # Endpoint business logic
│   │   ├── middleware/            # Error handling, request validation, 404, auth
│   │   ├── models/                # 11 Mongoose database schemas & central index
│   │   ├── routes/                # Master router & module sub-routers
│   │   ├── app.js                 # Express application configuration
│   │   └── server.js              # Server bootstrap & graceful shutdown
│   └── tests/
│       ├── health.test.js         # Express startup & health check test suite
│       └── models.test.js         # Mongoose schema, validation & hook test suite
├── frontend/                      # React 18 + Vite SPA (Port 5173)
│   ├── src/
│   │   ├── components/            # Design system (Alert, Button, DataTable, etc.)
│   │   ├── context/               # AuthContext, ToastContext, ThemeContext
│   │   ├── pages/                 # 10 core views (Dashboard, Funds, Ledger, etc.)
│   │   ├── routes/                # React Router with role-based route guards
│   │   ├── services/              # API clients conforming to docs/api-contract.md
│   │   └── tests/                 # Integration test suite (29 tests)
│   └── vite.config.js             # Chunk-optimized production build
└── package.json                   # Root workspace orchestration scripts
```

---

## 2. Backend Middleware Pipeline

Incoming HTTP requests flow through a hardened middleware stack in `backend/src/app.js`:

1. **Helmet:** Enforces security headers and cross-origin resource policy.
2. **CORS:** Configured for `http://localhost:5173` with `credentials: true`.
3. **Rate Limiting:** Protects against brute-force attacks (1000 requests per 15 minutes per IP).
4. **Parsers:** `express.json({ limit: '10mb' })`, `express.urlencoded()`, and `cookieParser()`.
5. **Morgan Logger:** HTTP request logging in development/staging.
6. **API Router:** Mounted at `/api` with `/health` and feature modules.
7. **404 Not Found Handler:** Formats missing routes into the standard JSON envelope.
8. **Centralized Error Handler:** Intercepts Mongoose validation errors, duplicate keys (`E11000`), CastErrors, and JWT errors, returning standard error envelopes without leaking stack traces in production.

### Standard Response Envelope
All API endpoints conform to the unified envelope:
```json
{
  "success": true,
  "message": "Status description",
  "data": { ... },
  "errors": null
}
```

---

## 3. Database Schemas & Financial Integrity (Mongoose)

All 11 domain models are defined in `backend/src/models/`:

| Model | Key Fields & Responsibilities | Integrity Controls |
|---|---|---|
| **Society** | `name`, `code` (unique), `registrationNumber`, `address`, `contactEmail` | Single tenant isolation root |
| **User** | `name`, `email` (unique), `passwordHash`, `role` (enum of 5 roles), `society` | `passwordHash` hidden by default; pre-save bcrypt hook |
| **Fund** | `name`, `code`, `type` (`CORPUS`, `SINKING`, etc.), `currentBalancePaise` | Balances stored in **integer paise**; virtual `currentBalanceRupees` |
| **Transaction** | `reference`, `amountPaise`, `type`, `status`, `reversalOf` | Pre-delete hooks prevent physical deletion; requires reversal workflow |
| **Approval** | `description`, `requestedAmountPaise`, `requester`, `status`, `decisionHistory` | Separation-of-duties enforcement; decision audit timestamps |
| **Event** | `title`, `proposedBudgetPaise`, `approvedBudgetPaise`, `actualExpenditurePaise` | Complete budget lifecycle tracking; quotations & breakdown subdocs |
| **Compliance** | `filingType`, `statutoryBody`, `deadline`, `status` (`PENDING`, `FILED`, etc.) | Virtual `isOverdue` computed from deadline vs current date |
| **Reconciliation** | `accountName`, `statementClosingBalancePaise`, `bookClosingBalancePaise` | Virtual `differenceAmountPaise` calculates discrepancy |
| **AuditLog** | `actor`, `action`, `entityType`, `details`, `ipAddress`, `severity` | **Immutable**: Pre-save and pre-delete hooks reject updates and deletions |
| **Document** | `name`, `category`, `sizeBytes`, `storagePath`, `verificationStatus` | Storage path hidden by default; virtual `sizeDisplay` |
| **ResidentQuery** | `subject`, `question`, `category`, `status` (`OPEN` → `RESOLVED`), `responses` | Resident privacy protection; full question-answer lifecycle |

### Financial Safety Standard: Integer Paise
To eliminate IEEE-754 floating point rounding errors, all monetary amounts are stored as integers in **paise** (1 Rupee = 100 Paise). Mongoose virtual getters automatically expose rupee representations for display without mutating stored values.

---

## 4. Frontend Foundation & Design System

The frontend in `frontend/` implements an accessible, responsive financial governance interface:

- **Theme System (`ThemeContext`):** Light and Dark mode with persistence in `localStorage` and system preference detection (`prefers-color-scheme`). Dark mode styles are applied via `dark:` Tailwind classes.
- **Component Library (`frontend/src/components/common/`):**
  - `Alert`: Contextual notices (`info`, `success`, `warning`, `error`, `neutral`) with dismiss actions.
  - `Button`: Primary, secondary, outline, ghost, danger variants with loading spinner states.
  - `DataTable`: Paginated tabular view with responsive cell alignment and empty/loading states.
  - `SummaryCard`: Metric KPI cards with trend indicators and status badges.
  - `ConfirmDialog`: Modal confirmation for high-impact financial actions (reversals, sign-outs).
  - `SearchFilterToolbar`, `Input`, `Select`, `FormField`, `Pagination`, `StatusBadge`, `Toast`.
- **Application Shell:** Responsive desktop sidebar, mobile drawer navigation, breadcrumbs, community status banner, and theme toggle in `Topbar`.

---

## 5. Verification Commands

The full test suite can be run from the root workspace:

```bash
# Run both frontend and backend test suites (83 passing tests)
npm test

# Run frontend integration tests only (29 tests)
npm run test:frontend

# Run backend health and model validation tests only (54 tests)
npm run test:backend

# Build production bundle with optimized chunking
npm run build
```

---

## 6. Execution Commands

To run the platform locally in development mode:

```bash
# Start backend API (Port 5000 with --watch auto-reloading)
npm run dev:backend

# Start frontend Vite server (Port 5173)
npm run dev:frontend
```
