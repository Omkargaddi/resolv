package models

import (
	"regexp"
	"testing"
	"time"
)

func TestUserPasswordHashAndCompare(t *testing.T) {
	u := &User{
		Name:     "Test User",
		Email:    "test@example.com",
		Role:     UserRoleMember,
		IsActive: true,
	}

	rawPassword := "SuperSecret123!"
	if err := u.HashPassword(rawPassword); err != nil {
		t.Fatalf("unexpected error hashing password: %v", err)
	}

	if u.Password == rawPassword {
		t.Errorf("expected hashed password to differ from raw password")
	}

	if !u.ComparePassword(rawPassword) {
		t.Errorf("expected correct password comparison to return true")
	}

	if u.ComparePassword("WrongPassword") {
		t.Errorf("expected incorrect password comparison to return false")
	}
}

func TestSlotAvailabilityAndAccommodate(t *testing.T) {
	slot := &Slot{
		Status:            SlotStatusAvailable,
		Capacity:          4,
		RemainingCapacity: 2,
		EndTime:           time.Now().Add(1 * time.Hour),
	}

	if !slot.IsAvailable() {
		t.Errorf("expected slot to be available")
	}

	slot.RemainingCapacity = 0
	if slot.IsAvailable() {
		t.Errorf("expected slot with 0 remaining capacity to not be available")
	}

	slot.RemainingCapacity = 2
	slot.Status = SlotStatusBlocked
	if slot.IsAvailable() {
		t.Errorf("expected blocked slot to not be available")
	}

	slot.Status = SlotStatusAvailable
	if !slot.CanAccommodate(1) {
		t.Errorf("expected slot to accommodate 1 guest")
	}
	if !slot.CanAccommodate(2) {
		t.Errorf("expected slot to accommodate 2 guests")
	}
	if slot.CanAccommodate(3) {
		t.Errorf("expected slot to not accommodate 3 guests when capacity is 2")
	}
}

func TestSlotIsPast(t *testing.T) {
	pastSlot := &Slot{
		EndTime: time.Now().Add(-1 * time.Hour),
	}
	if !pastSlot.IsPast() {
		t.Errorf("expected slot in the past to return true for IsPast")
	}

	futureSlot := &Slot{
		EndTime: time.Now().Add(1 * time.Hour),
	}
	if futureSlot.IsPast() {
		t.Errorf("expected future slot to return false for IsPast")
	}
}

func TestBookingConfirmationCodeAndCancellable(t *testing.T) {
	code := GenerateConfirmationCode()
	matched, err := regexp.MatchString(`^RSV-[A-Z0-9]{8}$`, code)
	if err != nil || !matched {
		t.Errorf("confirmation code %s does not match expected pattern RSV-[A-Z0-9]{8}", code)
	}

	booking := &Booking{
		Status: BookingStatusConfirmed,
	}
	if !booking.IsCancellable() {
		t.Errorf("expected confirmed booking to be cancellable")
	}

	booking.Status = BookingStatusCancelled
	if booking.IsCancellable() {
		t.Errorf("expected cancelled booking to not be cancellable")
	}

	booking.Status = BookingStatusCompleted
	if booking.IsCancellable() {
		t.Errorf("expected completed booking to not be cancellable")
	}
}
