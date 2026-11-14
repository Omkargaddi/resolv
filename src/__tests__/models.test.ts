import 'reflect-metadata';
import { User, UserRole } from '../models/User';
import { Slot, SlotStatus } from '../models/Slot';
import { Booking, BookingStatus } from '../models/Booking';

describe('Models Unit Tests', () => {
  describe('User Model', () => {
    it('should hash password on insert and compare properly', async () => {
      const user = new User();
      user.name = 'Test User';
      user.email = 'test@example.com';
      user.password = 'SuperSecret123!';
      user.role = UserRole.MEMBER;

      await user.hashPassword();
      expect(user.password).not.toBe('SuperSecret123!');

      const isMatch = await user.comparePassword('SuperSecret123!');
      expect(isMatch).toBe(true);

      const isWrong = await user.comparePassword('WrongPassword');
      expect(isWrong).toBe(false);
    });

    it('should not expose password in toJSON', () => {
      const user = new User();
      user.id = 'uuid-123';
      user.name = 'Test User';
      user.email = 'test@example.com';
      user.password = 'hashedpassword';
      user.role = UserRole.MEMBER;
      user.isActive = true;

      const json = user.toJSON() as Record<string, unknown>;
      expect(json.password).toBeUndefined();
      expect(json.email).toBe('test@example.com');
      expect(json.name).toBe('Test User');
    });
  });

  describe('Slot Model', () => {
    it('should correctly calculate isAvailable', () => {
      const slot = new Slot();
      slot.status = SlotStatus.AVAILABLE;
      slot.remainingCapacity = 2;
      expect(slot.isAvailable).toBe(true);

      slot.remainingCapacity = 0;
      expect(slot.isAvailable).toBe(false);

      slot.remainingCapacity = 2;
      slot.status = SlotStatus.BLOCKED;
      expect(slot.isAvailable).toBe(false);
    });

    it('should correctly evaluate canAccommodate', () => {
      const slot = new Slot();
      slot.status = SlotStatus.AVAILABLE;
      slot.remainingCapacity = 3;

      expect(slot.canAccommodate(2)).toBe(true);
      expect(slot.canAccommodate(3)).toBe(true);
      expect(slot.canAccommodate(4)).toBe(false);
    });

    it('should correctly check if slot is past', () => {
      const slot = new Slot();
      const pastTime = new Date(Date.now() - 3600000);
      slot.endTime = pastTime;
      expect(slot.isPast).toBe(true);

      const futureTime = new Date(Date.now() + 3600000);
      slot.endTime = futureTime;
      expect(slot.isPast).toBe(false);
    });
  });

  describe('Booking Model', () => {
    it('should generate RSV confirmation code before insert', () => {
      const booking = new Booking();
      expect(booking.confirmationCode).toBeUndefined();

      booking.generateConfirmationCode();
      expect(booking.confirmationCode).toMatch(/^RSV-[A-Z0-9]{8}$/);
    });

    it('should correctly determine isCancellable based on status', () => {
      const booking = new Booking();
      booking.status = BookingStatus.CONFIRMED;
      expect(booking.isCancellable).toBe(true);

      booking.status = BookingStatus.CANCELLED;
      expect(booking.isCancellable).toBe(false);

      booking.status = BookingStatus.COMPLETED;
      expect(booking.isCancellable).toBe(false);
    });
  });
});
