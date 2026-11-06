import { Router } from 'express';
import {
  getEvents,
  getEventById,
  createEvent,
  approveEvent,
  addQuotation,
  selectVendor,
  settleEvent,
} from '../controllers/eventsController.js';
import { authenticate } from '../middleware/authMiddleware.js';
import { requireRoles, enforceSocietyIsolation } from '../middleware/rbacMiddleware.js';

const router = Router();

router.use(authenticate, enforceSocietyIsolation);

const eventProposers = ['Society Administrator', 'Treasurer', 'Committee Member'];

router.get('/', getEvents);
router.get('/:id', getEventById);
router.post('/', requireRoles(...eventProposers), createEvent);
router.post('/:id/approve', requireRoles(...eventProposers), approveEvent);
router.post('/:id/quotations', requireRoles(...eventProposers), addQuotation);
router.post('/:id/select-vendor', requireRoles(...eventProposers), selectVendor);
router.post('/:id/settle', requireRoles('Society Administrator', 'Treasurer'), settleEvent);

export default router;
