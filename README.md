# SocietyLedger

[![React](https://img.shields.io/badge/React-18.3-149ECA?logo=react&logoColor=white)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-5.4-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)
[![Node.js](https://img.shields.io/badge/Node.js-20-339933?logo=nodedotjs&logoColor=white)](https://nodejs.org/)
[![Express](https://img.shields.io/badge/Express-4.21-000000?logo=express&logoColor=white)](https://expressjs.com/)
[![MongoDB](https://img.shields.io/badge/MongoDB-8-47A248?logo=mongodb&logoColor=white)](https://www.mongodb.com/)
[![License](https://img.shields.io/badge/license-not%20specified-lightgrey)](#license)

SocietyLedger is a financial transparency and governance platform for apartment communities and Resident Welfare Associations (RWAs).

Residents can see published balances, events, and reports. Treasurers, committee members, auditors, and the Society Administrator manage funds, vouchers, approvals, compliance, bank reconciliation, and private documents. Every record belongs to one society. A user cannot read or change another society’s data.

## Key features

- Five roles with separate dashboards and route guards
- Funds, vouchers, and reports stored in integer paise (1 rupee = 100 paise)
- Expense approvals with separation of duties
- Community events, vendor quotations, and settlement
- Resident portal with published figures and questions
- Statutory compliance tracker
- Bank reconciliation against imported statement rows
- Audit log and audit observations
- Private document upload, role-based download, and delete
- Society administrator tools for members and the invitation code

## Demo

**Live app:** [https://societyledger-rwa-iota.vercel.app](https://societyledger-rwa-iota.vercel.app)

The live site is the Vercel project `societyledger-rwa`. Sign-in requires an account that was created in that deployment’s database. Local demo accounts are not copied there.

### Screenshots

Add images under `docs/screenshots/` and keep these links. The files are not in the repository yet.

| Screen | Preview |
| --- | --- |
| Sign in | ![Sign in](docs/screenshots/login.png) |
| Society Administrator dashboard | ![Administrator dashboard](docs/screenshots/admin-dashboard.png) |
| Resident portal | ![Resident portal](docs/screenshots/resident-portal.png) |
| Funds | ![Funds](docs/screenshots/funds.png) |
| Reports | ![Reports](docs/screenshots/reports.png) |

## Tech stack

| Layer | Technologies |
| --- | --- |
| Frontend | React 18.3, React Router 6.28, Vite 5.4, Tailwind CSS 3.4, Axios, Recharts, Lucide icons |
| Backend | Node.js (ES modules), Express 4.21, Helmet, CORS, cookie-parser, express-rate-limit, Morgan |
| Database | MongoDB with Mongoose 8.9 |
| Authentication | JSON Web Tokens (`jsonwebtoken`), bcrypt (`bcryptjs`), HttpOnly cookie `jwt_token` |
| Storage | Local `backend/uploads` in development and on Render; private Vercel Blob in production |
| Deployment | Vercel Services (`vercel.json`), Render blueprint (`render.yaml`) |
| Tooling | Node test scripts in `backend/tests` and `frontend/src/tests` |

## Architecture overview

```text
Browser (React)
    │  Axios, withCredentials
    ▼
/api/*  ──►  Express app
                │  JWT cookie or Authorization: Bearer
                │  role check + society id from the token
                ▼
             MongoDB database society_ledger
                │
                └── private document bytes
                      local disk  or  Vercel Blob (production)
```

1. The React app calls the API with `VITE_API_BASE_URL`. Locally that is `http://localhost:5000/api`. On the single Vercel project it is `/api`, so the browser stays on one origin.
2. Login and registration return a JWT. The API also sets an HttpOnly cookie named `jwt_token`. The browser keeps a copy of the access token in memory only. It is not written to `localStorage`.
3. Later requests send the cookie (`withCredentials: true`) or a `Bearer` token. `authenticate` loads the user. `enforceSocietyIsolation` sets `req.societyId` from that user and rejects a mismatched `societyId`.
4. Controllers read and write only that society’s documents. Money is stored as integer paise so rupee math does not use floating-point values.
5. Successful JSON responses use one envelope:

```json
{
  "success": true,
  "message": "Human-readable result",
  "data": {},
  "errors": null
}
```

Failures use `success: false`, a message, `data: null`, and an `errors` array. Document download is the exception: it streams the file.

### Database relationships

`Society` is the root. These collections store a `society` ObjectId:

`User`, `Fund`, `Transaction`, `Approval`, `Event`, `Compliance`, `Reconciliation`, `AuditLog`, `Document`, `ResidentQuery`, `Observation`

Typical links inside one society:

- `Transaction.fund` → `Fund`
- `Transaction` transfers may point at a second fund
- `Approval` and `Event` may reference a fund
- `Document` may reference a transaction, approval, event, or compliance task
- `User.society` → `Society`
- Audit logs record `actor`, `action`, and `entityId`

## Project structure

```text
SocietyLedger/
├── frontend/                 React + Vite client
│   ├── src/pages/            Screens (auth, dashboards, funds, reports, …)
│   ├── src/components/       Layout, form controls, route guard
│   ├── src/context/          Auth, theme, toasts
│   ├── src/services/         Axios client and API helpers
│   ├── src/routes/           Browser router and role gates
│   ├── src/tests/            Frontend integration checks
│   └── .env.example
├── backend/
│   ├── api/index.js          Vercel function entry (no listen)
│   ├── src/server.js         Local and Render process (listen + shutdown)
│   ├── src/app.js            Express app, CORS, cookies, rate limit
│   ├── src/routes/           HTTP routes under /api
│   ├── src/controllers/      Request handlers
│   ├── src/models/           Mongoose schemas
│   ├── src/middleware/       Auth, RBAC, society isolation, errors
│   ├── src/storage/          Local files or private Vercel Blob
│   ├── src/bootstrap/        One-time production society setup
│   ├── src/seeds/seed.js     Local demo data only. Destructive.
│   ├── tests/                Backend test scripts
│   └── .env.example
├── vercel.json               One Vercel project: web + API
├── render.yaml               Optional Render blueprint
├── VERCEL_DEPLOYMENT_GUIDE.md
└── README.md
```

| Path | What it does |
| --- | --- |
| `frontend/src/services/api.js` | Base URL, mock-data switch, cookie credentials |
| `frontend/src/services/apiContract.js` | Role names and which screens each role may open |
| `backend/src/config/db.js` | Mongo connection reuse and the `society_ledger` name rule |
| `backend/src/config/productionEnv.js` | Rejects missing or development secrets in production |
| `backend/src/bootstrap/productionInit.js` | Creates Greenwood Heights and one administrator when confirmed |

## Installation guide

### Prerequisites

- Node.js 20 or newer
- npm
- MongoDB Community Server running locally, or a MongoDB Atlas cluster

### Clone the repository

```bash
git clone https://github.com/Varsh2176/SocietyLedger-RWA.git
cd SocietyLedger-RWA
```

### Install dependencies

```bash
npm install --prefix backend
npm install --prefix frontend
```

### Environment variables

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

On Windows PowerShell, copy the files instead of using `cp` if that command is unavailable:

```powershell
Copy-Item backend\.env.example backend\.env
Copy-Item frontend\.env.example frontend\.env
```

Replace the JWT and cookie placeholders in `backend/.env` with long random strings before you share the machine. Leave `MONGODB_URI` on the local address for development.

### Database setup

Start MongoDB so this address answers:

`mongodb://127.0.0.1:27017/society_ledger`

The API creates the database on first write. Collections are created by Mongoose when the first document is saved.

Optional local demo data:

```bash
npm run seed --prefix backend
```

`seed` deletes and recreates local Greenwood Heights data, including users and financial records. Run it only against a local database you are willing to replace. Never point it at Atlas or any shared database.

### Run the backend

```bash
npm run dev --prefix backend
```

The API listens on `http://localhost:5000`. Check `http://localhost:5000/api/health`. A healthy response has `"success": true` and `data.database.status` of `"connected"`.

### Run the frontend

```bash
npm run dev --prefix frontend
```

Open `http://localhost:5173`. Use `localhost`, not `127.0.0.1`, so the session cookie is sent to the API.

### Tests

```bash
npm test --prefix backend
npm test --prefix frontend
```

Backend tests expect local MongoDB at `mongodb://127.0.0.1:27017/society_ledger`. They refuse an Atlas URI. Set that local URI in the same command if your shell already has a different `MONGODB_URI`, because dotenv does not override an existing variable.

## Environment variables

Copy the examples. Do not commit real `.env` files.

### Backend

| Variable | Purpose | Example value |
| --- | --- | --- |
| `PORT` | Port for the local and Render process | `5000` |
| `NODE_ENV` | `development`, `test`, or `production` | `development` |
| `MONGODB_URI` | Mongo connection. Production and Atlas must use database `society_ledger` | `mongodb://127.0.0.1:27017/society_ledger` |
| `JWT_SECRET` | Signs access tokens. Production rejects the example placeholder | `replace-with-a-long-random-jwt-secret` |
| `JWT_EXPIRES_IN` | Token lifetime | `1d` |
| `COOKIE_SECRET` | Signs cookies. Must differ from `JWT_SECRET` | `replace-with-a-long-random-cookie-secret` |
| `CLIENT_URL` | Exact browser origin allowed by CORS | `http://localhost:5173` |
| `UPLOADS_DIR` | Optional private upload directory for local development and Render | `/var/data/uploads` |
| `BLOB_STORE_ID` | Private Vercel Blob store. Required in production when no token is set | `store_example` |
| `BLOB_READ_WRITE_TOKEN` | Blob token for a store that is not using Vercel OIDC | `replace-with-the-private-blob-token` |
| `MONGODB_MAX_POOL_SIZE` | Optional pool size from 1 to 20. Default is 5 | `5` |
| `BOOTSTRAP_CONFIRM` | Must be `INITIALIZE_GREENWOOD_HEIGHTS` before production init | `INITIALIZE_GREENWOOD_HEIGHTS` |
| `CONFIRM_ATLAS_INIT` | Must be `YES` before any Atlas write from bootstrap | `YES` |
| `BOOTSTRAP_ADMIN_NAME` | Initial administrator display name | `Society Administrator` |
| `BOOTSTRAP_ADMIN_EMAIL` | Initial administrator email. Demo `@society.org` addresses are rejected | `admin@example.com` |
| `BOOTSTRAP_ADMIN_PASSWORD` | Initial password, at least 12 characters, not a demo password | `replace-with-a-long-password` |

### Frontend

| Variable | Purpose | Example value |
| --- | --- | --- |
| `VITE_API_BASE_URL` | API origin. A trailing `/api` is optional. Production builds reject localhost | `http://localhost:5000/api` |
| `VITE_APP_NAME` | Application title | `SocietyLedger` |
| `VITE_ENABLE_MOCK_FALLBACK` | Sample figures when the API is down. Ignored in production. Keep `false` | `false` |

Vite reads `VITE_*` variables when the frontend is built. Changing them requires a new frontend build.

## API documentation

Base path: `/api`

Unless noted, send the session cookie or:

```http
Authorization: Bearer <token>
```

### Health

| Method | Route | Purpose | Request body | Example response |
| --- | --- | --- | --- | --- |
| `GET` | `/api/health` | Process and database status. Public | None | `{ "success": true, "data": { "database": { "status": "connected", "name": "society_ledger" } } }` |

Returns 503 when MongoDB is not connected.

### Authentication

| Method | Route | Purpose | Request body | Example response |
| --- | --- | --- | --- | --- |
| `POST` | `/api/auth/register` | Create a Resident. Role and society id in the body are ignored. Account stays pending verification | `{ "name", "email", "password", "phone", "apartmentNumber", "societyCode" }` | `{ "success": true, "data": { "user": { "role": "Resident", "verificationStatus": "PENDING" } } }` |
| `POST` | `/api/auth/login` | Sign in and set `jwt_token` | `{ "email", "password" }` | `{ "success": true, "data": { "user": { "role": "Treasurer" }, "token": "<jwt>" } }` |
| `POST` | `/api/auth/logout` | Clear the cookie | None | `{ "success": true, "data": null }` |
| `GET` | `/api/auth/me` | Current user | None | `{ "success": true, "data": { "user": { "email": "member@example.com", "role": "Resident" } } }` |
| `POST` | `/api/auth/refresh` | Issue a new token for the current session | None | `{ "success": true, "data": { "token": "<jwt>" } }` |

### Funds, vouchers, dashboard, and reports

Governance roles can manage funds. Residents see active funds and posted amounts according to the reporting rules in the controllers. Amounts may be sent as rupees (`amount`, `openingBalance`) or integer paise (`amountPaise`, `openingBalancePaise`).

| Method | Route | Who | Purpose | Request body | Example response |
| --- | --- | --- | --- | --- | --- |
| `GET` | `/api/funds` | Signed in | List funds for the caller’s society | None | `{ "success": true, "data": { "funds": [] } }` |
| `GET` | `/api/funds/:id` | Signed in | One fund | None | `{ "success": true, "data": { "fund": { "code": "CORPUS" } } }` |
| `POST` | `/api/funds` | Administrator, Treasurer | Create a fund. Client `fiscalYear` is ignored | `{ "name", "code", "type", "openingBalance" }` | `{ "success": true, "data": { "fund": {} } }` |
| `PATCH` | `/api/funds/:id` | Administrator, Treasurer | Update name, purpose, bank account, or status | `{ "name", "purpose", "status" }` | `{ "success": true, "data": { "fund": {} } }` |
| `GET` | `/api/transactions` | Signed in | List vouchers | None | `{ "success": true, "data": { "transactions": [] } }` |
| `GET` | `/api/transactions/:id` | Signed in | One voucher | None | `{ "success": true, "data": { "transaction": {} } }` |
| `POST` | `/api/transactions` | Administrator, Treasurer | Post a voucher | `{ "type": "EXPENSE", "description": "Lift repair", "fund": "<fundId>", "amount": 1000, "paymentMethod": "UPI" }` | `{ "success": true, "data": { "transaction": {} } }` |
| `POST` | `/api/transactions/:id/reverse` | Administrator, Treasurer | Audited reversal | `{ "justification": "Duplicate voucher" }` | `{ "success": true, "data": { "transaction": {} } }` |
| `GET` | `/api/dashboard/summary` | Signed in | Totals for a period | Query `period` | `{ "success": true, "data": { "summary": {} } }` |
| `GET` | `/api/dashboard/charts` | Signed in | Rolling six-month chart, separate from the summary period | Query `period` | `{ "success": true, "data": { "charts": {} } }` |
| `GET` | `/api/reports/income-expenditure` | Signed in | Income and expenditure | Query `period` | `{ "success": true, "data": {} }` |
| `GET` | `/api/reports/fund-statement` | Signed in | Movement by fund | Query `period` | `{ "success": true, "data": {} }` |
| `GET` | `/api/reports/balance-sheet` | Signed in | Balances. Period does not restate the sheet | Query `period` | `{ "success": true, "data": {} }` |

`type` for a fund is `CORPUS`, `OPERATIONAL`, `SINKING`, or `SPECIAL_PROJECT`. Voucher `type` is `INCOME`, `EXPENSE`, or `TRANSFER`. Payment methods are `NEFT_RTGS`, `UPI`, `CHEQUE`, `CARD`, and `CASH`.

A query or body `societyId` that does not match the signed-in society returns 403.

### Events and approvals

| Method | Route | Who | Purpose | Request body | Example response |
| --- | --- | --- | --- | --- | --- |
| `GET` | `/api/events` | Signed in | List events. Residents receive published events only | None | `{ "success": true, "data": { "events": [] } }` |
| `GET` | `/api/events/:id` | Signed in | One event | None | `{ "success": true, "data": { "event": {} } }` |
| `POST` | `/api/events` | Administrator, Treasurer, Committee | Propose an event | `{ "title": "Annual day", "date": "2026-12-01", "proposedBudget": 25000 }` | `{ "success": true, "data": { "event": { "status": "PROPOSED" } } }` |
| `POST` | `/api/events/:id/approve` | Administrator, Treasurer, Committee | Approve the budget | `{ "approvedBudget": 25000, "resolution": "AGM-12" }` | `{ "success": true, "data": { "event": {} } }` |
| `POST` | `/api/events/:id/quotations` | Administrator, Treasurer, Committee | Add a vendor bid | `{ "name": "Vendor", "quotationRef": "Q-1", "bidAmount": 24000 }` | `{ "success": true, "data": { "event": {} } }` |
| `POST` | `/api/events/:id/select-vendor` | Administrator, Treasurer, Committee | Choose a quotation | `{ "quotationId": "<id>" }` | `{ "success": true, "data": { "event": {} } }` |
| `POST` | `/api/events/:id/settle` | Administrator, Treasurer | Record actual spend and settle | `{ "actualExpenditure": 24000, "settlementNotes": "Paid" }` | `{ "success": true, "data": { "event": { "status": "SETTLED" } } }` |
| `GET` | `/api/approvals` | Signed in, role-filtered | List expense requests | None | `{ "success": true, "data": { "approvals": [] } }` |
| `GET` | `/api/approvals/:id` | Signed in, role-filtered | One request | None | `{ "success": true, "data": { "approval": {} } }` |
| `POST` | `/api/approvals` | Administrator, Treasurer, Committee | Open a request. The requester cannot approve it | `{ "description": "Paint", "requestedAmount": 8000, "fund": "<fundId>" }` | `{ "success": true, "data": { "approval": { "status": "PENDING" } } }` |
| `POST` | `/api/approvals/:id/decision` | Administrator, Treasurer, Committee. Auditors cannot decide | Approve, reject, or request information | `{ "action": "APPROVED", "comments": "Within budget" }` | `{ "success": true, "data": { "approval": {} } }` |

### Resident portal

| Method | Route | Who | Purpose | Request body | Example response |
| --- | --- | --- | --- | --- | --- |
| `GET` | `/api/resident/transparency` | All five roles | Published balances and events. Bank account numbers are masked for residents | None | `{ "success": true, "data": { "funds": [], "events": [] } }` |
| `GET` | `/api/resident/queries` | All five roles | Questions for this society | None | `{ "success": true, "data": { "queries": [] } }` |
| `POST` | `/api/resident/queries` | Resident, Committee, Administrator | Ask a question | `{ "category": "MAINTENANCE", "subject": "Water", "question": "When is the tank cleaned?", "unit": "A-101" }` | `{ "success": true, "data": { "query": { "status": "OPEN" } } }` |
| `POST` | `/api/resident/queries/:id/respond` | Committee, Treasurer, Administrator | Answer a question | `{ "response": "First Monday", "newStatus": "ANSWERED" }` | `{ "success": true, "data": { "query": {} } }` |

### Compliance

Residents cannot open these routes. Committee members can read and attach documents. Creating and filing is limited to the Administrator and Treasurer.

| Method | Route | Purpose | Request body | Example response |
| --- | --- | --- | --- | --- |
| `GET` | `/api/compliance/dashboard` | Summary counts | None | `{ "success": true, "data": { "summary": {} } }` |
| `GET` | `/api/compliance/export/summary` | Statement export for an AGM or auditor | None | `{ "success": true, "data": {} }` |
| `GET` | `/api/compliance` | List tasks | None | `{ "success": true, "data": { "tasks": [] } }` |
| `GET` | `/api/compliance/:id` | One task | None | `{ "success": true, "data": { "task": {} } }` |
| `POST` | `/api/compliance` | Create a task | `{ "filingType": "TDS return", "statutoryBody": "Income Tax", "financialPeriod": "2026-27", "deadline": "2026-07-31", "deadlineSource": "Statute" }` | `{ "success": true, "data": { "task": {} } }` |
| `PUT` | `/api/compliance/:id` | Update metadata | Task fields | `{ "success": true, "data": { "task": {} } }` |
| `POST` | `/api/compliance/:id/record-filing` | Record a filing | Filing date and acknowledgement fields accepted by the controller | `{ "success": true, "data": { "task": {} } }` |
| `POST` | `/api/compliance/:id/status` | Change lifecycle status | `{ "action": "FILED", "comments": "Acknowledgement uploaded" }` | `{ "success": true, "data": { "task": {} } }` |
| `POST` | `/api/compliance/:id/documents` | Attach a supporting reference | `{ "title": "Challan", "documentType": "RECEIPT", "fileName": "challan.pdf" }` | `{ "success": true, "data": { "task": {} } }` |

### Reconciliation

Committee members and residents cannot open reconciliation.

| Method | Route | Who writes | Purpose | Request body | Example response |
| --- | --- | --- | --- | --- | --- |
| `GET` | `/api/reconciliation` | Readers: Administrator, Treasurer, Auditor | List sessions | None | `{ "success": true, "data": { "sessions": [] } }` |
| `GET` | `/api/reconciliation/:id` | Readers | One session | None | `{ "success": true, "data": { "session": {} } }` |
| `POST` | `/api/reconciliation` | Administrator, Treasurer | Open a session | `{ "fundId", "accountName", "statementPeriodStart", "statementPeriodEnd", "statementClosingBalance" }` | `{ "success": true, "data": { "session": {} } }` |
| `POST` | `/api/reconciliation/:id/import-statement` | Administrator, Treasurer | Import rows | `{ "rows": [], "rawCsvText": "date,amount,narration" }` | `{ "success": true, "data": { "session": {} } }` |
| `POST` | `/api/reconciliation/:id/match` | Administrator, Treasurer, Auditor | Match a row to a voucher | `{ "statementTxId", "ledgerTxId", "notes" }` | `{ "success": true, "data": { "session": {} } }` |
| `POST` | `/api/reconciliation/:id/unmatch` | Same | Remove a match | `{ "statementTxId" }` | `{ "success": true, "data": { "session": {} } }` |
| `POST` | `/api/reconciliation/:id/discrepancies/:discrepancyId/resolve` | Same | Explain a difference | `{ "explanation": "Bank charge", "correctiveAction": "Voucher posted", "status": "RESOLVED" }` | `{ "success": true, "data": { "session": {} } }` |
| `POST` | `/api/reconciliation/:id/finalize` | Same | Lock the session | `{ "notes": "Agreed" }` | `{ "success": true, "data": { "session": { "status": "RECONCILED" } } }` |

### Audit

| Method | Route | Who | Purpose | Request body | Example response |
| --- | --- | --- | --- | --- | --- |
| `GET` | `/api/audit/logs` | Administrator, Auditor | Immutable action log | None | `{ "success": true, "data": { "logs": [] } }` |
| `GET` | `/api/audit/observations` | Administrator, Treasurer, Committee, Auditor | Findings list | None | `{ "success": true, "data": { "observations": [] } }` |
| `POST` | `/api/audit/observations` | Administrator, Auditor | Record a finding | `{ "title": "Missing invoice", "finding": "Voucher 12 has no invoice" }` | `{ "success": true, "data": { "observation": { "status": "OPEN" } } }` |
| `PUT` | `/api/audit/observations/:id` | Administrator, Auditor | Update a finding | Observation fields | `{ "success": true, "data": { "observation": {} } }` |

### Documents

Downloads stay on `/api/documents/:id/download`. The API does not return a public Blob URL. `storagePath` is omitted from JSON.

| Method | Route | Who | Purpose | Request body | Example response |
| --- | --- | --- | --- | --- | --- |
| `GET` | `/api/documents` | All roles. Residents see published files only | List metadata | None | `{ "success": true, "data": { "documents": [{ "downloadUrl": "/api/documents/<id>/download" }] } }` |
| `GET` | `/api/documents/:id` | Same visibility rules | Metadata | None | `{ "success": true, "data": { "document": {} } }` |
| `GET` | `/api/documents/:id/download` | Same. Unpublished files return 403 for a resident | Stream the file | None | File bytes, `Content-Disposition: attachment` |
| `POST` | `/api/documents` | Committee, Treasurer, Auditor, Administrator | Upload. Allowed extensions: pdf, png, jpg, jpeg, xlsx, csv, txt | `{ "name", "category", "fileName", "mimeType", "fileDataBase64", "isPublishedToResidents": false }` | `{ "success": true, "data": { "document": {} } }` |
| `POST` | `/api/documents/:id/verify` | Auditor, Treasurer, Administrator | Verify or reject | `{ "status": "VERIFIED", "notes": "Matches the voucher" }` | `{ "success": true, "data": { "document": {} } }` |
| `DELETE` | `/api/documents/:id` | Uploader or Society Administrator | Delete metadata and the stored file | None | `{ "success": true, "data": null }` |

Local and Render uploads allow 10 MB. Production Blob uploads allow 3 MB so the base64 JSON body stays under the platform limit.

### Society administration

All `/api/admin` routes require the Society Administrator role.

| Method | Route | Purpose | Request body | Example response |
| --- | --- | --- | --- | --- |
| `GET` | `/api/admin/members` | Member directory | None | `{ "success": true, "data": { "members": [] } }` |
| `GET` | `/api/admin/members/:id` | One member | None | `{ "success": true, "data": { "member": {} } }` |
| `PATCH` | `/api/admin/members/:id/status` | Activate or deactivate. The last active administrator cannot be deactivated | `{ "isActive": false }` | `{ "success": true, "data": { "member": {} } }` |
| `PATCH` | `/api/admin/members/:id/role` | Change role. The last active administrator cannot be demoted | `{ "role": "Committee Member" }` | `{ "success": true, "data": { "member": {} } }` |
| `GET` | `/api/admin/society` | Society profile | None | `{ "success": true, "data": { "society": { "name": "Greenwood Heights RWA" } } }` |
| `PUT` | `/api/admin/society` | Update profile fields the controller accepts | `{ "contactEmail": "office@example.com" }` | `{ "success": true, "data": { "society": {} } }` |
| `POST` | `/api/admin/invitation-code/rotate` | Replace the registration code | None | `{ "success": true, "data": { "code": "GW-EXAMPLE" } }` |

`GET` or `POST` `/api/future-roadmap` returns HTTP 501. It is a reserved path, not a feature.

## Database schema

Database name: `society_ledger`

| Collection | Important fields | Relationships |
| --- | --- | --- |
| `societies` | `name`, `code` (invitation code), `registrationNumber`, `fiscalYearStartMonth`, `isActive`, address and contact | Parent of every other record |
| `users` | `name`, `email` (unique), `passwordHash` (bcrypt, not selected by default), `role`, `verificationStatus`, `isActive`, `apartmentNumber` | `society` → Society. Roles: Society Administrator, Treasurer, Committee Member, Auditor, Resident |
| `funds` | `name`, `code`, `type`, `status`, balances in paise, `bankAccount`, `fiscalYear` | `society` → Society |
| `transactions` | `reference`, `date`, `type`, `status`, `amountPaise`, `paymentMethod`, `description` | `society`, `fund`. Corrections are reversals, not silent edits |
| `approvals` | description, requested amount in paise, `status`, decision history | `society`, optional fund and event. Requester cannot decide their own request |
| `events` | `title`, `date`, `status`, budgets in paise, quotations, selected vendor | `society`, optional funding fund |
| `compliances` | filing type, statutory body, period, deadline, status | `society` |
| `reconciliations` | fund, statement period, balances, imported rows, matches, discrepancies | `society`, `fund` |
| `auditlogs` | `actor`, `action`, `entityType`, `entityId`, `severity`, `details` | `society` |
| `documents` | `name`, `category`, `mimeType`, `sizeBytes`, `storagePath` (hidden), `isPublishedToResidents`, verification | `society`, `uploadedBy`, optional related records |
| `residentqueries` | category, subject, question, status, response | `society`, author |
| `observations` | title, finding, severity, status, recommendation | `society` |

Indexes include unique user email, unique society invitation code, and society-scoped lookups on users. Controllers also reject duplicate fund codes inside one society.

## Authentication and authorization

### Login flow

1. The visitor opens `/login` or `/register`.
2. Registration requires name, email, password (at least 6 characters), phone, apartment number, and the society invitation code (`Society.code`). The new user is always a Resident with verification `PENDING`.
3. Login checks the bcrypt hash. Inactive or rejected accounts are refused by the controller.
4. The API signs a JWT containing the user id, role, and society id. Expiry defaults to `1d`.
5. The token is returned in JSON and set as cookie `jwt_token` (`HttpOnly`, `SameSite=Lax`, `Secure` in production, path `/`).
6. The React app stores the token in memory, marks the session active, and sends the user to a role home: residents to `/resident-portal`, other roles to `/`.

Logout clears the cookie and the in-memory token. A 401 on a request from the active session opens the session-expired dialog.

### Protected routes

The UI (`ProtectedRoute`) and the API (`authenticate`, `requireRoles`, `enforceSocietyIsolation`) both enforce access. Hiding a link is not the security control. The API is.

| Screen | Roles |
| --- | --- |
| `/` governance dashboard | Administrator, Treasurer, Committee, Auditor |
| `/resident-portal` | Resident |
| `/funds` | Governance roles except Resident |
| `/transactions`, `/events`, `/reports` | All five roles, with data filtered by role |
| `/approvals` | Administrator, Treasurer, Committee |
| `/compliance` | Governance roles except Resident |
| `/reconciliation` | Administrator, Treasurer, Auditor |
| `/audit` | Administrator, Auditor |
| `/settings` | Society Administrator |

Residents who open a governance-only URL return to the resident portal. Other roles see the unauthorized page. An unauthenticated visit goes to `/login`.

Production requires real `JWT_SECRET` and `COOKIE_SECRET` values. Development fallbacks and the example placeholders are rejected when `NODE_ENV=production`.

## Features

- **Society isolation.** The society id comes from the authenticated user. A client-supplied society id that does not match returns 403.
- **Role dashboards.** Each governance role has its own dashboard. Residents have a separate portal and cannot open the governance dashboard by URL.
- **Funds.** Named reserves with type, status (`ACTIVE`, `SUSPENDED`, `CLOSED`), purpose, and optional bank account. New funds take the society’s fiscal start month. A client-supplied fiscal year is ignored.
- **Vouchers.** Income, expense, and transfer. Status moves through pending, approved, paid, reconciled, rejected, or reversed. Posted income and expense include approved, paid, and reconciled vouchers. A reversal requires a justification and writes an offset entry.
- **Reporting.** Income and expenditure, fund statement, and balance sheet. Dashboard charts cover a rolling six months and are labeled separately from the selected summary period. Residents see active-fund balances. Suspended and closed funds remain visible to governance. Residents see actual event spend only after an event is completed or settled.
- **Approvals.** Requests record the amount, fund, vendor, and a decision history. The requester cannot approve their own request. Auditors can read approved requests and cannot decide.
- **Events.** Proposed, approved, in progress, completed, settled, or cancelled. Quotations can be added and one vendor selected. Settlement records actual expenditure.
- **Resident questions.** Residents and committee members can ask. Committee, treasurer, and administrator can answer.
- **Compliance.** Tasks track statutory filings, deadlines, status, and supporting documents, with a legal disclaimer in the UI.
- **Reconciliation.** Import statement rows, match them to vouchers, resolve discrepancies, and finalize the session.
- **Audit.** Administrators and auditors read the action log and manage observations. Treasurer and committee can read the observation list.
- **Documents.** Metadata, verification, and authenticated download. Production stores bytes in a private Blob store. Local development stores them under `backend/uploads` or `UPLOADS_DIR`.
- **Administration.** Member status and role changes, society profile, and invitation-code rotation. The last active Society Administrator cannot be demoted or deactivated.
- **Sample data switch.** The Node test runner may use sample figures. A production build never does, even if `VITE_ENABLE_MOCK_FALLBACK=true`.

## Future enhancements

- Email delivery for registration and password reset. There is no reset endpoint today.
- Pagination and search on the largest lists as societies grow.
- A shared rate-limit store. The current limit is 1,000 requests per 15 minutes per API instance, kept in memory.
- Direct-to-Blob uploads for files larger than the 3 MB production request cap.
- Static outbound addresses for Atlas network rules, instead of a broad allow list.
- Scheduled reminders for compliance deadlines.
- A root `LICENSE` file once the owner chooses a license.

## Deployment

Full Vercel steps, health checks, and rollback are in [VERCEL_DEPLOYMENT_GUIDE.md](VERCEL_DEPLOYMENT_GUIDE.md).

### Frontend and backend together on Vercel

`vercel.json` defines one project:

- Service `web` builds `frontend` with Vite and rewrites unknown paths to `index.html`, so a refresh on `/funds` still loads the app.
- Service `api` runs `backend/api/index.js` as Express. It does not call `listen`.
- Public routing sends `/api/*` to the API first, then every other path to the site.
- Functions are set to region `bom1` (Mumbai), next to an Atlas cluster in `ap-south-1`.

Set the API variables from the table above with `NODE_ENV=production`, an Atlas URI whose path is `/society_ledger`, and `CLIENT_URL` equal to the site origin. Connect a **private** Blob store so `BLOB_STORE_ID` is present. For the web build set:

```text
VITE_API_BASE_URL=/api
VITE_ENABLE_MOCK_FALLBACK=false
```

Do not add `npm run seed` or `npm run bootstrap:production` to the build.

After the API is healthy, initialize production once from `backend` with the confirmation variables set in that shell. The command creates Greenwood Heights RWA (`RWA/2021/489`) and one Society Administrator only when they are absent. It does not import local users or financial records. A second run leaves the existing society, invitation code, and password hash unchanged.

```bash
npm run bootstrap:production --prefix backend
```

### Render

`render.yaml` describes an optional split deployment: Node API `societyledger-api` and static site `societyledger-web`, both in Singapore. The API starts with `npm start`, checks `/api/health`, and stores uploads on a disk at `/var/data`. Applying the blueprint creates services. It does not deploy until the blueprint is synced and a deploy is approved. Do not put a real MongoDB URI in `render.yaml`.

### Local production build of the frontend

```bash
cd frontend
# PowerShell
$env:VITE_API_BASE_URL='/api'
$env:VITE_ENABLE_MOCK_FALLBACK='false'
npm run build
```

The build fails if `VITE_API_BASE_URL` is missing or points at `localhost` or `127.0.0.1`.

## Troubleshooting

| Symptom | What to check |
| --- | --- |
| Health returns 503 | MongoDB is not running, or `MONGODB_URI` is wrong. `data.database.name` must be `society_ledger` in production. |
| Production process exits before listen | `validateProductionEnv` prints the missing variable name. It does not print the secret. Set JWT, cookie, client URL, MongoDB, and Blob configuration. |
| Login succeeds and the next call is 401 | The page was opened on `127.0.0.1` while the API is on `localhost`, or `CLIENT_URL` does not exactly match the site origin. |
| Browser shows sample rupee amounts | `VITE_ENABLE_MOCK_FALLBACK` is `true` in development, or the API is unreachable. Production builds ignore the flag. |
| CORS error | `CLIENT_URL` must be the exact origin, including `https` and with no path. |
| Document upload returns 503 | Production Blob is not connected, or the store is public. Create it with private access. |
| Document upload returns 413 | The file plus base64 exceeded the platform body limit. Stay at or below 3 MB in production. |
| Deep link returns a host 404 | The web service rewrite to `/index.html` is missing, or it is ordered ahead of `/api`. |
| `npm test` hits the wrong database | Export `MONGODB_URI=mongodb://127.0.0.1:27017/society_ledger` in the same command. An existing environment variable wins over `.env`. |
| Rate limit (429) | This instance has seen 1,000 requests in 15 minutes. Restarting the local API clears the in-memory counter. |

## Contributing

1. Fork the repository and create a branch from `main`.
2. Keep secrets out of Git. Update `.env.example` with placeholders only.
3. Do not run `npm run seed` against a database that holds data you need. Do not run production bootstrap unless you intend to create the Greenwood society.
4. Add or update a test in `backend/tests` or `frontend/src/tests` when you change behavior. Run both test commands before opening a pull request.
5. Describe the user-visible change in the pull request. Do not weaken a test to make the suite pass.

## License

This repository does not include a `LICENSE` file. All rights stay with the copyright holder until a license is added. Do not assume the code is open for reuse, modification, or redistribution.

## Author

**Varsh2176**

Repository: [https://github.com/Varsh2176/SocietyLedger-RWA](https://github.com/Varsh2176/SocietyLedger-RWA)
