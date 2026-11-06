import { Router } from 'express';
import {
  register,
  login,
  logout,
  getMe,
  refreshToken,
} from '../controllers/authController.js';
import { authenticate } from '../middleware/authMiddleware.js';

const router = Router();

router.post('/register', register);
router.post('/login', login);
router.post('/logout', logout);
router.get('/me', authenticate, getMe);
router.post('/refresh', authenticate, refreshToken);

export default router;
