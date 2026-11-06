import { Router } from 'express';
import {
  getTransparencyData,
  getQueries,
  submitQuery,
  respondToQuery,
} from '../controllers/residentController.js';
import { authenticate } from '../middleware/authMiddleware.js';
import { requireRoles, enforceSocietyIsolation } from '../middleware/rbacMiddleware.js';

const router = Router();

// All resident portal routes require authentication and society isolation
router.use(authenticate, enforceSocietyIsolation);

// 1. Transparency summary (Available to all 5 roles)
router.get(
  '/transparency',
  requireRoles('Resident', 'Committee Member', 'Treasurer', 'Auditor', 'Society Administrator'),
  getTransparencyData
);

// 2. Query list (Available to all 5 roles; scoped in controller)
router.get(
  '/queries',
  requireRoles('Resident', 'Committee Member', 'Treasurer', 'Auditor', 'Society Administrator'),
  getQueries
);

// 3. Submit question (Residents, Committee Members, Admins)
router.post(
  '/queries',
  requireRoles('Resident', 'Committee Member', 'Society Administrator'),
  submitQuery
);

// 4. Respond to question (Committee Members, Treasurers, Admins)
router.post(
  '/queries/:id/respond',
  requireRoles('Committee Member', 'Treasurer', 'Society Administrator'),
  respondToQuery
);

export default router;
