import { Request, Response } from 'express';
import { AppDataSource } from '../config/database';
import { Slot, SlotStatus } from '../models/Slot';
import { BookingService } from '../services/BookingService';
import { AuthenticatedRequest } from '../middleware/auth';
import { WebSocketService } from '../utils/websocket';
import { logger } from '../utils/logger';

export class SlotController {
  private static bookingService = new BookingService(AppDataSource);

  static async getAvailableSlots(req: Request, res: Response): Promise<void> {
    try {
      const { venueId } = req.params;
      const { date } = req.query;

      if (!venueId || !date) {
        res.status(400).json({
          error: 'venueId param and date query parameter (YYYY-MM-DD) are required',
          code: 'BAD_USER_INPUT',
        });
        return;
      }

      const slots = await SlotController.bookingService.getAvailableSlots(
        venueId,
        String(date)
      );

      res.json(slots);
    } catch (error) {
      logger.error('Failed to get available slots', { error });
      res.status(500).json({
        error: 'Failed to retrieve available slots',
        code: 'INTERNAL_SERVER_ERROR',
      });
    }
  }

  static async getSlotById(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const slotRepo = AppDataSource.getRepository(Slot);
      const slot = await slotRepo.findOne({ where: { id } });

      if (!slot) {
        res.status(404).json({
          error: 'Slot not found',
          code: 'NOT_FOUND',
        });
        return;
      }

      res.json(slot);
    } catch (error) {
      logger.error('Failed to get slot by ID', { error });
      res.status(500).json({
        error: 'Failed to retrieve slot',
        code: 'INTERNAL_SERVER_ERROR',
      });
    }
  }

  static async blockSlot(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { reason } = req.body;

      const slotRepo = AppDataSource.getRepository(Slot);
      const slot = await slotRepo.findOne({ where: { id } });

      if (!slot) {
        res.status(404).json({
          error: 'Slot not found',
          code: 'NOT_FOUND',
        });
        return;
      }

      slot.status = SlotStatus.BLOCKED;
      slot.metadata = {
        ...slot.metadata,
        blockReason: reason,
        blockedBy: req.user!.userId,
      };
      await slotRepo.save(slot);

      await SlotController.bookingService.invalidateSlotCache(slot.venueId, slot.date);

      logger.info('Slot blocked by admin', {
        slotId: id,
        adminId: req.user!.userId,
        reason,
      });

      WebSocketService.getInstance().broadcast('slotAvailabilityChanged', {
        slotId: slot.id,
        venueId: slot.venueId,
        status: slot.status,
        remainingCapacity: slot.remainingCapacity,
      });

      res.json(slot);
    } catch (error) {
      logger.error('Failed to block slot', { error });
      res.status(500).json({
        error: 'Failed to block slot',
        code: 'INTERNAL_SERVER_ERROR',
      });
    }
  }

  static async unblockSlot(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      const slotRepo = AppDataSource.getRepository(Slot);
      const slot = await slotRepo.findOne({ where: { id } });

      if (!slot) {
        res.status(404).json({
          error: 'Slot not found',
          code: 'NOT_FOUND',
        });
        return;
      }

      slot.status = slot.remainingCapacity > 0 ? SlotStatus.AVAILABLE : SlotStatus.BOOKED;
      if (slot.metadata) {
        delete slot.metadata.blockReason;
        delete slot.metadata.blockedBy;
      }
      await slotRepo.save(slot);
      await SlotController.bookingService.invalidateSlotCache(slot.venueId, slot.date);

      logger.info('Slot unblocked by admin', {
        slotId: id,
        adminId: req.user!.userId,
      });

      WebSocketService.getInstance().broadcast('slotAvailabilityChanged', {
        slotId: slot.id,
        venueId: slot.venueId,
        status: slot.status,
        remainingCapacity: slot.remainingCapacity,
      });

      res.json(slot);
    } catch (error) {
      logger.error('Failed to unblock slot', { error });
      res.status(500).json({
        error: 'Failed to unblock slot',
        code: 'INTERNAL_SERVER_ERROR',
      });
    }
  }
}

export default SlotController;
