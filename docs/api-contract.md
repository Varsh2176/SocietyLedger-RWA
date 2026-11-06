# SocietyLedger API Contract & Architecture Specification

This document defines the official endpoints, request/response models, and governance rules agreed for the **SocietyLedger** platform across all modules.

---

## 1. Security & Authentication Architecture

- **Session Handling:** `HttpOnly`, `SameSite=Lax/Strict`, `Secure` cookies for authentication.
- **Client Storage:** Sensitive tokens and passwords are **never** stored in `localStorage` or `sessionStorage`.
- **CORS Credentials:** All client requests specify `withCredentials: true`.
- **Role Enforcement:** All API endpoints must independently verify the user's role and society scope on the backend. Frontend route guards are for navigation assistance only.

### User Roles
- `Society Administrator`
- `Treasurer`
- `Committee Member`
- `Auditor`
- `Resident`

---

## 2. Standard Financial Enums

### Transaction Statuses
- `PENDING`: Newly posted voucher awaiting required signoffs.
- `APPROVED`: Sanctioned by the Treasurer or Management Committee.
- `PAID`: Disbursed through bank transfer, UPI, or cheque.
- `REJECTED`: Disapproved by committee due to policy violations or lack of bids.
- `REVERSED`: Corrective accounting reversal with mandatory audit justification. Finalized transactions are **never** deleted.
- `RECONCILED`: Audited and matched against verified bank statements.

### Transaction Types
- `INCOME`: Maintenance collections, deposit interest, penalty fees.
- `EXPENSE`: Operating expenses, AMC contracts, utility bills, capital works.
- `TRANSFER`: Transfer between internal society bank sub-ledgers.

### Fund Classifications
- `CORPUS`: Permanent fixed deposit reserve pool.
- `SINKING`: Ring-fenced capital asset replacement pool (lifts, exterior paint, generators).
- `OPERATIONAL`: Monthly liquidity for recurring operational bills.
- `SPECIAL_PROJECT`: Designated capital fund for member-approved initiatives (e.g. rooftop solar).

---

## 3. Financial Endpoints Contract

### 3.1. Dashboard Aggregations (`GET /api/dashboard/summary`)
- **Query Params:** `?period=current_month | last_quarter | financial_year`
- **Response Format:**
  ```json
  {
    "success": true,
    "data": {
      "totalAvailableFunds": 4897750,
      "corpusFundBalance": 2840000,
      "maintenanceFundBalance": 612350,
      "sinkingFundBalance": 1445400,
      "totalIncomeMonth": 1845000,
      "totalExpenseMonth": 236400,
      "pendingApprovalsCount": 3,
      "pendingReconciliationsCount": 2,
      "overdueComplianceCount": 0,
      "openAuditObservationsCount": 1,
      "statutoryAuditStatus": "VERIFIED_FY25_26"
    }
  }
  ```

### 3.2. Dashboard Visualizations (`GET /api/dashboard/charts`)
- **Response Format:**
  ```json
  {
    "success": true,
    "data": {
      "monthlyCashflow": [
        { "month": "Oct 26", "income": 1845000, "expenditure": 236400, "netReserve": 1608600 }
      ],
      "fundDistribution": [
        { "name": "Corpus Reserve", "value": 2840000, "color": "#1E3A8A" }
      ],
      "categoryBreakdown": [
        { "category": "Lift & Elevator AMC", "amount": 48500 }
      ],
      "eventBudgetVsActual": [
        { "event": "Ganesh Utsav", "allocatedBudget": 75000, "actualExpense": 72800 }
      ]
    }
  }
  ```

### 3.3. Fund Management (`/api/funds`)
- **`GET /api/funds`**: List and search funds.
- **`POST /api/funds`** (Admin / Treasurer):
  ```json
  {
    "name": "Elevator Modernization Capital Fund",
    "code": "FND-ELEV-26",
    "type": "SINKING",
    "openingBalance": 500000,
    "restrictedUse": true,
    "purpose": "Capital overhaul of 4 passenger elevators in Block A & B.",
    "fiscalYear": "FY 2026-27",
    "bankAccount": "SBI - A/C ****9102"
  }
  ```

### 3.4. General Ledger Transactions (`/api/transactions`)
- **`GET /api/transactions`**: Query parameters `?page=1&limit=10&search=&type=&fund=&status=&startDate=&endDate=&sortKey=&sortOrder=`
- **`POST /api/transactions`** (Treasurer / Admin):
  ```json
  {
    "reference": "VR-2026-090",
    "date": "2026-10-25",
    "type": "EXPENSE",
    "fund": "Monthly Maintenance & Operational Account",
    "fundCode": "FND-MAINT",
    "category": "Lift AMC",
    "description": "Quarterly comprehensive lift maintenance",
    "amount": 18500,
    "paymentMethod": "NEFT_RTGS",
    "vendorName": "Johnson Lifts Pvt Ltd",
    "invoiceNumber": "INV-JL-2026-441"
  }
  ```
- **`POST /api/transactions/:id/reverse`** (Treasurer / Admin):
  ```json
  {
    "justification": "Duplicate payment voucher posted for Lift AMC."
  }
  ```

### 3.5. Financial Reports (`/api/reports/*`)
- **`GET /api/reports/income-expenditure?period=current_month`**
- **`GET /api/reports/fund-statement?period=current_month`**
- **`GET /api/reports/balance-sheet?period=current_month`**

### 3.6. Resident Transparency & Clarification Queries (`/api/resident/*`)
- **`GET /api/resident/transparency`**: Returns certified published disclosures (fund balances with masked accounts, I&E aggregates, ratified committee resolutions, certified audit summaries).
- **`GET /api/resident/queries`**: Query list with status (`OPEN`, `IN_PROGRESS`, `ANSWERED`, `RESOLVED`).
- **`POST /api/resident/queries`**:
  ```json
  {
    "category": "Maintenance Billing",
    "subject": "Water tanker expense clarification",
    "question": "Could the committee clarify the surge in emergency tanker expenses in September?",
    "unit": "Block B - 302"
  }
  ```
- **Privacy Enforcement:** Full bank account numbers, vendor personal bank credentials, and unpublished preliminary committee drafts are permanently redacted from resident scopes.

---

## 4. Financial Safety Rules Enforced by Frontend

1. **Calculated Balances:** Frontend never computes official balances independently; all card balances and statement totals are served directly by backend aggregations.
2. **INR Currency Formatting:** All monetary values are rendered in standard Indian Rupee notation (`₹ 1,47,000`) without altering underlying data types.
3. **No Silent Deletions:** Transactions cannot be deleted; corrections require an audited reversal workflow with mandatory justifications.
4. **Data Isolation:** Society-scoped query parameters are passed and verified for every request.
