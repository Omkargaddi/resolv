import { Router } from 'express';
import { VenueController } from '../controllers/VenueController';
import { SlotController } from '../controllers/SlotController';

const router = Router();

router.get('/', VenueController.getVenues);
router.get('/:id', VenueController.getVenueById);
router.get('/:venueId/slots', SlotController.getAvailableSlots);

export default router;
