import { Router } from 'express';
import { AdminController } from '../controllers/AdminController';
import { authenticate, authorizeRole } from '../middleware/auth';
import { UserRole } from '../models/User';

const router = Router();

router.get('/queue-stats', authenticate, authorizeRole(UserRole.ADMIN), AdminController.getQueueStats);

export default router;
