import { Response } from 'express';
import { AppDataSource } from '../config/database';
import { Slot } from '../models/Slot';
import { UserRole } from '../models/User';
import { BookingStatus } from '../models/Booking';
import { BookingService, BookingError } from '../services/BookingService';
import { AuthenticatedRequest } from '../middleware/auth';
import { consumeMutationRateLimit } from '../middleware/rateLimiter';
import { WebSocketService } from '../utils/websocket';
import { logger } from '../utils/logger';

export class BookingController {
  private static bookingService = new BookingService(AppDataSource);

  static async createBooking(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { slotId, venueId, guestCount = 1, notes } = req.body;

      if (!slotId || !venueId) {
        res.status(400).json({
          error: 'slotId and venueId are required',
          code: 'BAD_USER_INPUT',
        });
        return;
      }

      await consumeMutationRateLimit(`booking:create:${req.user!.userId}`);

      const booking = await BookingController.bookingService.createBooking({
        userId: req.user!.userId,
        slotId,
        venueId,
        guestCount: parseInt(String(guestCount), 10),
        notes,
      });

      // Broadcast slot availability change
      const slot = await AppDataSource.getRepository(Slot).findOne({
        where: { id: slotId },
      });

      if (slot) {
        WebSocketService.getInstance().broadcast('slotAvailabilityChanged', {
          slotId: slot.id,
          venueId: slot.venueId,
          status: slot.status,
          remainingCapacity: slot.remainingCapacity,
        });
      }

      // Broadcast booking status change
      WebSocketService.getInstance().broadcast('bookingStatusChanged', {
        bookingId: booking.id,
        status: booking.status,
        confirmationCode: booking.confirmationCode,
        userId: req.user!.userId,
      });

      res.status(201).json(booking);
    } catch (error) {
      if (error instanceof BookingError) {
        res.status(error.statusCode).json({
          error: error.message,
          code: error.code,
        });
        return;
      }

      logger.error('Failed to create booking', { error });
      res.status(500).json({
        error: error instanceof Error ? error.message : 'An unexpected error occurred',
        code: 'INTERNAL_SERVER_ERROR',
      });
    }
  }

  static async cancelBooking(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { reason } = req.body;

      const booking = await BookingController.bookingService.cancelBooking({
        bookingId: id,
        userId: req.user!.userId,
        reason,
      });

      const slot = await AppDataSource.getRepository(Slot).findOne({
        where: { id: booking.slotId },
      });

      if (slot) {
        WebSocketService.getInstance().broadcast('slotAvailabilityChanged', {
          slotId: slot.id,
          venueId: slot.venueId,
          status: slot.status,
          remainingCapacity: slot.remainingCapacity,
        });
      }

      WebSocketService.getInstance().broadcast('bookingStatusChanged', {
        bookingId: booking.id,
        status: booking.status,
        confirmationCode: booking.confirmationCode,
        userId: req.user!.userId,
      });

      res.json(booking);
    } catch (error) {
      if (error instanceof BookingError) {
        res.status(error.statusCode).json({
          error: error.message,
          code: error.code,
        });
        return;
      }

      logger.error('Failed to cancel booking', { error });
      res.status(500).json({
        error: error instanceof Error ? error.message : 'An unexpected error occurred',
        code: 'INTERNAL_SERVER_ERROR',
      });
    }
  }

  static async getBookingById(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const booking = await BookingController.bookingService.getBookingById(id);

      if (!booking) {
        res.status(404).json({
          error: 'Booking not found',
          code: 'NOT_FOUND',
        });
        return;
      }

      if (
        booking.userId !== req.user!.userId &&
        req.user!.role !== UserRole.ADMIN
      ) {
        res.status(403).json({
          error: 'Not authorized to view this booking',
          code: 'FORBIDDEN',
        });
        return;
      }

      res.json(booking);
    } catch (error) {
      logger.error('Failed to get booking by ID', { error });
      res.status(500).json({
        error: 'Failed to retrieve booking',
        code: 'INTERNAL_SERVER_ERROR',
      });
    }
  }

  static async getBookingByCode(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { code } = req.params;
      const booking = await BookingController.bookingService.getBookingByConfirmationCode(code);

      if (!booking) {
        res.status(404).json({
          error: 'Booking not found',
          code: 'NOT_FOUND',
        });
        return;
      }

      if (
        booking.userId !== req.user!.userId &&
        req.user!.role !== UserRole.ADMIN
      ) {
        res.status(403).json({
          error: 'Not authorized to view this booking',
          code: 'FORBIDDEN',
        });
        return;
      }

      res.json(booking);
    } catch (error) {
      logger.error('Failed to get booking by confirmation code', { error });
      res.status(500).json({
        error: 'Failed to retrieve booking',
        code: 'INTERNAL_SERVER_ERROR',
      });
    }
  }

  static async getMyBookings(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const status = req.query.status as BookingStatus | undefined;
      const limit = parseInt(String(req.query.limit || '20'), 10);
      const offset = parseInt(String(req.query.offset || '0'), 10);

      const { bookings, total } = await BookingController.bookingService.getBookingsByUser(
        req.user!.userId,
        status,
        limit,
        offset
      );

      res.json({
        data: bookings,
        pagination: {
          total,
          limit,
          offset,
          hasNextPage: offset + limit < total,
          hasPreviousPage: offset > 0,
        },
      });
    } catch (error) {
      logger.error('Failed to get user bookings', { error });
      res.status(500).json({
        error: 'Failed to retrieve bookings',
        code: 'INTERNAL_SERVER_ERROR',
      });
    }
  }
}

export default BookingController;
