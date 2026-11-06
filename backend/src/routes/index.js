import { Router } from 'express';
import healthRoutes from './healthRoutes.js';
import authRoutes from './authRoutes.js';
import fundsRoutes from './fundsRoutes.js';
import transactionsRoutes from './transactionsRoutes.js';
import reportsRoutes from './reportsRoutes.js';
import dashboardRoutes from './dashboardRoutes.js';
import eventsRoutes from './eventsRoutes.js';
import approvalsRoutes from './approvalsRoutes.js';
import residentRoutes from './residentRoutes.js';
import complianceRoutes from './complianceRoutes.js';
import reconciliationRoutes from './reconciliationRoutes.js';
import auditRoutes from './auditRoutes.js';
import documentsRoutes from './documentsRoutes.js';
import adminRoutes from './adminRoutes.js';

const apiRouter = Router();

// 1. Core Health Check
apiRouter.use('/health', healthRoutes);

// 2. Authentication & Session Management
apiRouter.use('/auth', authRoutes);

// 3. Corpus Fund & Financial Management
apiRouter.use('/funds', fundsRoutes);
apiRouter.use('/transactions', transactionsRoutes);
apiRouter.use('/reports', reportsRoutes);
apiRouter.use('/dashboard', dashboardRoutes);

// 4. Events & Expense Approvals Governance
apiRouter.use('/events', eventsRoutes);
apiRouter.use('/approvals', approvalsRoutes);

// 5. Resident Transparency Portal & Queries
apiRouter.use('/resident', residentRoutes);

// 6. Tax & Statutory Compliance Tracker
apiRouter.use('/compliance', complianceRoutes);

// 7. Bank Reconciliation & Financial Verification
apiRouter.use('/reconciliation', reconciliationRoutes);

// 8. Audit Trail & Observations
apiRouter.use('/audit', auditRoutes);

// 9. Secure Document Management
apiRouter.use('/documents', documentsRoutes);

// 10. Society Administrator management
apiRouter.use('/admin', adminRoutes);

// Future roadmap stub handler
const pendingModuleMessage = (moduleName) => (req, res) => {
  res.status(501).json({
    success: false,
    message: `${moduleName} API endpoint is scheduled for subsequent full-stack phase.`,
    data: null,
    errors: [`Endpoint ${req.method} ${req.originalUrl} not implemented yet`],
  });
};

apiRouter.use('/future-roadmap', pendingModuleMessage('Future Advanced Integrations'));

export default apiRouter;
