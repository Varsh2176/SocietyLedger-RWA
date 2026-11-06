import { Router } from 'express';
import {
  getDocuments,
  getDocumentById,
  uploadDocument,
  downloadDocument,
  verifyDocument,
  deleteDocument,
} from '../controllers/documentsController.js';
import { authenticate } from '../middleware/authMiddleware.js';
import { requireRoles, enforceSocietyIsolation } from '../middleware/rbacMiddleware.js';

const router = Router();

// Authentication required for all document repository endpoints
router.use(authenticate, enforceSocietyIsolation);

// 1. List documents (residents restricted to published documents in controller)
router.get(
  '/',
  requireRoles('Resident', 'Committee Member', 'Treasurer', 'Auditor', 'Society Administrator'),
  getDocuments
);

// 2. View document metadata
router.get(
  '/:id',
  requireRoles('Resident', 'Committee Member', 'Treasurer', 'Auditor', 'Society Administrator'),
  getDocumentById
);

// 3. Download / stream document
router.get(
  '/:id/download',
  requireRoles('Resident', 'Committee Member', 'Treasurer', 'Auditor', 'Society Administrator'),
  downloadDocument
);

// 4. Upload document (Committee Members, Treasurers, Auditors, Admins)
router.post(
  '/',
  requireRoles('Committee Member', 'Treasurer', 'Auditor', 'Society Administrator'),
  uploadDocument
);

// 5. Verify / reject document (Auditors, Treasurers, Admins)
router.post(
  '/:id/verify',
  requireRoles('Auditor', 'Treasurer', 'Society Administrator'),
  verifyDocument
);

// 6. Delete document (Admin or original uploader)
router.delete(
  '/:id',
  requireRoles('Committee Member', 'Treasurer', 'Auditor', 'Society Administrator'),
  deleteDocument
);

export default router;
