import { Router } from 'express';
import {
  getAuditLogs,
  getAuditObservations,
  createAuditObservation,
  updateAuditObservation,
} from '../controllers/auditController.js';
import { authenticate } from '../middleware/authMiddleware.js';
import { requireRoles, enforceSocietyIsolation } from '../middleware/rbacMiddleware.js';

const router = Router();

// Authentication required for all audit endpoints
router.use(authenticate, enforceSocietyIsolation);

// Audit logs are limited to Society Administrator and Auditor.
// No product requirement grants the Treasurer this trail.
router.get(
  '/logs',
  requireRoles('Society Administrator', 'Auditor'),
  getAuditLogs
);

// 2. Audit observations and findings list
router.get(
  '/observations',
  requireRoles('Society Administrator', 'Treasurer', 'Committee Member', 'Auditor'),
  getAuditObservations
);

// 3. Create formal audit observation (Auditor & Admin only)
router.post(
  '/observations',
  requireRoles('Auditor', 'Society Administrator'),
  createAuditObservation
);

// Observation updates stay with Society Administrator and Auditor.
router.put(
  '/observations/:id',
  requireRoles('Society Administrator', 'Auditor'),
  updateAuditObservation
);

export default router;
