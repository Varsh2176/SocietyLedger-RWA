import { Router } from 'express';
import {
  listMembers,
  getMember,
  updateMemberStatus,
  updateMemberRole,
  getSocietyProfile,
  updateSocietyProfile,
  rotateInvitationCode,
} from '../controllers/adminController.js';
import { authenticate } from '../middleware/authMiddleware.js';
import { requireRoles, enforceSocietyIsolation } from '../middleware/rbacMiddleware.js';

const router = Router();

router.use(authenticate, enforceSocietyIsolation, requireRoles('Society Administrator'));

router.get('/members', listMembers);
router.get('/members/:id', getMember);
router.patch('/members/:id/status', updateMemberStatus);
router.patch('/members/:id/role', updateMemberRole);
router.get('/society', getSocietyProfile);
router.put('/society', updateSocietyProfile);
router.post('/invitation-code/rotate', rotateInvitationCode);

export default router;
