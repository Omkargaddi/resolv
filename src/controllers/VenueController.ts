import { Request, Response } from 'express';

export class VenueController {
  static async getVenues(_req: Request, res: Response): Promise<void> {
    // Placeholder venue list matching schema
    res.json([
      {
        id: '11111111-1111-1111-1111-111111111111',
        name: 'Main Hall',
        address: '100 Reservation Way, City Center',
        timezone: 'UTC',
        capacity: 100,
        isActive: true,
      },
    ]);
  }

  static async getVenueById(req: Request, res: Response): Promise<void> {
    const { id } = req.params;
    res.json({
      id,
      name: 'Main Hall',
      address: '100 Reservation Way, City Center',
      timezone: 'UTC',
      capacity: 100,
      isActive: true,
    });
  }
}

export default VenueController;
