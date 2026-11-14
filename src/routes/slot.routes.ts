import { Router } from 'express';
import { SlotController } from '../controllers/SlotController';
import { authenticate, authorizeRole } from '../middleware/auth';
import { UserRole } from '../models/User';

const router = Router();

router.get('/:id', SlotController.getSlotById);
router.post('/:id/block', authenticate, authorizeRole(UserRole.ADMIN), SlotController.blockSlot);
router.post('/:id/unblock', authenticate, authorizeRole(UserRole.ADMIN), SlotController.unblockSlot);

export default router;
