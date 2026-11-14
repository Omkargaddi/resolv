import 'reflect-metadata';
import 'dotenv/config';
import { initializeDatabase, closeDatabase, AppDataSource } from '../config/database';
import { User, UserRole } from '../models/User';
import { Slot, SlotStatus } from '../models/Slot';
import RedisClient from '../utils/redis';
import { logger } from '../utils/logger';

async function seed(): Promise<void> {
  logger.info('Starting database seeding...');

  await initializeDatabase();

  const userRepo = AppDataSource.getRepository(User);
  const slotRepo = AppDataSource.getRepository(Slot);

  // 1. Seed Users
  const existingAdmin = await userRepo.findOne({ where: { email: 'admin@reserve.local' } });
  if (!existingAdmin) {
    const admin = userRepo.create({
      name: 'System Admin',
      email: 'admin@reserve.local',
      password: 'AdminPassword123!',
      role: UserRole.ADMIN,
      isActive: true,
    });
    await userRepo.save(admin);
    logger.info('Seeded admin user: admin@reserve.local / AdminPassword123!');
  } else {
    logger.info('Admin user already exists');
  }

  const existingMember = await userRepo.findOne({ where: { email: 'user@example.com' } });
  if (!existingMember) {
    const member = userRepo.create({
      name: 'John Doe',
      email: 'user@example.com',
      password: 'securepass',
      role: UserRole.MEMBER,
      isActive: true,
      phone: '+1234567890',
    });
    await userRepo.save(member);
    logger.info('Seeded member user: user@example.com / securepass');
  } else {
    logger.info('Member user already exists');
  }

  // 2. Seed Sample Slots for a Demo Venue
  const sampleVenueId = '11111111-1111-1111-1111-111111111111';
  const slotCount = await slotRepo.count({ where: { venueId: sampleVenueId } });

  if (slotCount === 0) {
    const now = new Date();
    const slots: Slot[] = [];

    // Create slots for the next 7 days, 3 slots per day
    for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
      const slotDate = new Date(now);
      slotDate.setDate(now.getDate() + dayOffset);
      const dateString = slotDate.toISOString().split('T')[0];

      // 10:00 - 11:00
      const start1 = new Date(slotDate);
      start1.setHours(10, 0, 0, 0);
      const end1 = new Date(slotDate);
      end1.setHours(11, 0, 0, 0);

      // 14:00 - 15:00
      const start2 = new Date(slotDate);
      start2.setHours(14, 0, 0, 0);
      const end2 = new Date(slotDate);
      end2.setHours(15, 0, 0, 0);

      // 18:00 - 19:00
      const start3 = new Date(slotDate);
      start3.setHours(18, 0, 0, 0);
      const end3 = new Date(slotDate);
      end3.setHours(19, 0, 0, 0);

      const times = [
        { start: start1, end: end1, price: 25.0 },
        { start: start2, end: end2, price: 30.0 },
        { start: start3, end: end3, price: 50.0 },
      ];

      for (const time of times) {
        slots.push(
          slotRepo.create({
            venueId: sampleVenueId,
            date: dateString,
            startTime: time.start,
            endTime: time.end,
            capacity: 4,
            remainingCapacity: 4,
            status: SlotStatus.AVAILABLE,
            durationMinutes: 60,
            price: time.price,
            currency: 'USD',
          })
        );
      }
    }

    await slotRepo.save(slots);
    logger.info(`Seeded ${slots.length} slots for venue ${sampleVenueId}`);
  } else {
    logger.info(`Slots already exist for venue ${sampleVenueId}`);
  }

  await closeDatabase();
  await RedisClient.disconnect();
  logger.info('Database seeding completed successfully.');
}

seed().catch((error) => {
  logger.error('Failed to seed database', { error });
  process.exit(1);
});
