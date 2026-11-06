import { Router } from 'express';
import {
  getDashboardSummary,
  getDashboardCharts,
} from '../controllers/dashboardController.js';
import { authenticate } from '../middleware/authMiddleware.js';
import { enforceSocietyIsolation } from '../middleware/rbacMiddleware.js';

const router = Router();

router.use(authenticate, enforceSocietyIsolation);

router.get('/summary', getDashboardSummary);
router.get('/charts', getDashboardCharts);

export default router;
