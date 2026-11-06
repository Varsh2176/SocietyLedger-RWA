import { Router } from 'express';
import {
  getComplianceDashboard,
  getComplianceTasks,
  getComplianceTaskById,
  createComplianceTask,
  updateComplianceTask,
  recordFiling,
  transitionTaskStatus,
  addSupportingDocument,
  exportComplianceSummary,
} from '../controllers/complianceController.js';
import { authenticate } from '../middleware/authMiddleware.js';
import { requireRoles, enforceSocietyIsolation } from '../middleware/rbacMiddleware.js';

const router = Router();

// Authentication required for all compliance endpoints
router.use(authenticate, enforceSocietyIsolation);

// 1. Dashboard summary and metrics
router.get(
  '/dashboard',
  requireRoles('Society Administrator', 'Treasurer', 'Committee Member', 'Auditor'),
  getComplianceDashboard
);

// 2. Export compliance statement for AGM/Auditor
router.get(
  '/export/summary',
  requireRoles('Society Administrator', 'Treasurer', 'Committee Member', 'Auditor'),
  exportComplianceSummary
);

// 3. Search and list compliance tasks
router.get(
  '/',
  requireRoles('Society Administrator', 'Treasurer', 'Committee Member', 'Auditor'),
  getComplianceTasks
);

// 4. Retrieve single compliance task by ID
router.get(
  '/:id',
  requireRoles('Society Administrator', 'Treasurer', 'Committee Member', 'Auditor'),
  getComplianceTaskById
);

// 5. Create a new compliance task (Admin & Treasurer only)
router.post(
  '/',
  requireRoles('Society Administrator', 'Treasurer'),
  createComplianceTask
);

// 6. Update task metadata
router.put(
  '/:id',
  requireRoles('Society Administrator', 'Treasurer', 'Auditor'),
  updateComplianceTask
);

// 7. Record formal filing with submission date and acknowledgement proof
router.post(
  '/:id/record-filing',
  requireRoles('Society Administrator', 'Treasurer'),
  recordFiling
);

// 8. Lifecycle status transition (e.g., submit review, review approval, correction notice)
router.post(
  '/:id/status',
  requireRoles('Society Administrator', 'Treasurer', 'Auditor'),
  transitionTaskStatus
);

// 9. Attach supporting documents or challan receipts
router.post(
  '/:id/documents',
  requireRoles('Society Administrator', 'Treasurer', 'Committee Member', 'Auditor'),
  addSupportingDocument
);

export default router;
