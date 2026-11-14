import { Router } from 'express';
import { BookingController } from '../controllers/BookingController';
import { authenticate } from '../middleware/auth';

const router = Router();

router.post('/', authenticate, BookingController.createBooking);
router.get('/my', authenticate, BookingController.getMyBookings);
router.get('/code/:code', authenticate, BookingController.getBookingByCode);
router.get('/:id', authenticate, BookingController.getBookingById);
router.post('/:id/cancel', authenticate, BookingController.cancelBooking);

export default router;
