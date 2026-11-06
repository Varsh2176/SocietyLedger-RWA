# SocietyLedger

> Financial transparency and governance platform for apartment communities and Resident Welfare Associations (RWAs).

## Repository Architecture

This repository is maintained collaboratively by four specialized sub-teams:
- **Frontend Development:** React + Vite application shell, design system, and responsive financial views in `/frontend`.
- **Core Backend:** Node.js, Express.js, authentication, funds, transactions, and reporting APIs (to be located in `/backend`).
- **Database & Compliance:** MongoDB schemas, indexes, compliance documentation, and seed data.
- **Events & Audit:** Event workflows, expense approvals, vendor quotation comparisons, and financial audit logs.

## Frontend Setup & Execution

### Prerequisites
- Node.js (v18+ or v20+)
- npm or pnpm

### Getting Started

1. Navigate to the frontend workspace:
   ```bash
   cd frontend
   ```

2. Install dependencies (if not already installed):
   ```bash
   npm install
   ```

3. Start the Vite development server:
   ```bash
   npm run dev
   ```
   The local application will be available at `http://localhost:5173`.

4. Build for production:
   ```bash
   npm run build
   ```

5. Preview production build:
   ```bash
   npm run preview
   ```
