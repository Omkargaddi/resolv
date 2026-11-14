import { Response } from 'express';
import { QueueService } from '../services/QueueService';
import { AuthenticatedRequest } from '../middleware/auth';
import { logger } from '../utils/logger';

export class AdminController {
  static async getQueueStats(_req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const queueService = QueueService.getInstance();
      const stats = await queueService.getQueueStats();
      res.json(stats);
    } catch (error) {
      logger.error('Failed to get queue stats', { error });
      res.status(500).json({
        error: 'Failed to retrieve queue statistics',
        code: 'INTERNAL_SERVER_ERROR',
      });
    }
  }
}

export default AdminController;
