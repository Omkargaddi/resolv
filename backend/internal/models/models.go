package models

import (
	"crypto/rand"
	"encoding/hex"
	"strings"
	"time"

	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
)

type UserRole string

const (
	UserRoleGuest  UserRole = "guest"
	UserRoleMember UserRole = "member"
	UserRoleAdmin  UserRole = "admin"
)

type User struct {
	ID           string     `json:"id"`
	Name         string     `json:"name"`
	Email        string     `json:"email"`
	Password     string     `json:"-"`
	Phone        *string    `json:"phone,omitempty"`
	Role         UserRole   `json:"role"`
	IsActive     bool       `json:"isActive"`
	RefreshToken *string    `json:"-"`
	LastLoginAt  *time.Time `json:"lastLoginAt,omitempty"`
	CreatedAt    time.Time  `json:"createdAt"`
	UpdatedAt    time.Time  `json:"updatedAt"`
}

func (u *User) HashPassword(plainPassword string) error {
	hash, err := bcrypt.GenerateFromPassword([]byte(plainPassword), 12)
	if err != nil {
		return err
	}
	u.Password = string(hash)
	return nil
}

func (u *User) ComparePassword(candidatePassword string) bool {
	err := bcrypt.CompareHashAndPassword([]byte(u.Password), []byte(candidatePassword))
	return err == nil
}

type SlotStatus string

const (
	SlotStatusAvailable SlotStatus = "available"
	SlotStatusHeld      SlotStatus = "held"
	SlotStatusBooked    SlotStatus = "booked"
	SlotStatusBlocked   SlotStatus = "blocked"
)

type Slot struct {
	ID                string                 `json:"id"`
	VenueID           string                 `json:"venueId"`
	Date              string                 `json:"date"` // YYYY-MM-DD
	StartTime         time.Time              `json:"startTime"`
	EndTime           time.Time              `json:"endTime"`
	Capacity          int                    `json:"capacity"`
	RemainingCapacity int                    `json:"remainingCapacity"`
	Status            SlotStatus             `json:"status"`
	DurationMinutes   int                    `json:"durationMinutes"`
	Price             *float64               `json:"price,omitempty"`
	Currency          string                 `json:"currency"`
	Metadata          map[string]interface{} `json:"metadata,omitempty"`
	HeldUntil         *time.Time             `json:"heldUntil,omitempty"`
	CreatedAt         time.Time              `json:"createdAt"`
	UpdatedAt         time.Time              `json:"updatedAt"`
}

func (s *Slot) IsAvailable() bool {
	return s.Status == SlotStatusAvailable && s.RemainingCapacity > 0
}

func (s *Slot) CanAccommodate(count int) bool {
	return s.IsAvailable() && s.RemainingCapacity >= count
}

func (s *Slot) IsPast() bool {
	return s.EndTime.Before(time.Now())
}

type BookingStatus string

const (
	BookingStatusPending   BookingStatus = "pending"
	BookingStatusConfirmed BookingStatus = "confirmed"
	BookingStatusCancelled BookingStatus = "cancelled"
	BookingStatusCompleted BookingStatus = "completed"
	BookingStatusNoShow    BookingStatus = "no_show"
)

type Booking struct {
	ID                 string                 `json:"id"`
	UserID             string                 `json:"userId"`
	SlotID             string                 `json:"slotId"`
	VenueID            string                 `json:"venueId"`
	ConfirmationCode   string                 `json:"confirmationCode"`
	Status             BookingStatus          `json:"status"`
	GuestCount         int                    `json:"guestCount"`
	Notes              *string                `json:"notes,omitempty"`
	BookingDate        string                 `json:"bookingDate"`
	CancelledAt        *time.Time             `json:"cancelledAt,omitempty"`
	CancellationReason *string                `json:"cancellationReason,omitempty"`
	ConfirmedAt        *time.Time             `json:"confirmedAt,omitempty"`
	CompletedAt        *time.Time             `json:"completedAt,omitempty"`
	TotalPrice         *float64               `json:"totalPrice,omitempty"`
	Metadata           map[string]interface{} `json:"metadata,omitempty"`
	User               *User                  `json:"user,omitempty"`
	Slot               *Slot                  `json:"slot,omitempty"`
	CreatedAt          time.Time              `json:"createdAt"`
	UpdatedAt          time.Time              `json:"updatedAt"`
}

func GenerateConfirmationCode() string {
	b := make([]byte, 4)
	if _, err := rand.Read(b); err != nil {
		u := strings.ReplaceAll(uuid.New().String(), "-", "")
		return "RSV-" + strings.ToUpper(u[:8])
	}
	return "RSV-" + strings.ToUpper(hex.EncodeToString(b))
}

func (b *Booking) IsCancellable() bool {
	if b.Status == BookingStatusCancelled || b.Status == BookingStatusCompleted {
		return false
	}
	return true
}

type Venue struct {
	ID       string `json:"id"`
	Name     string `json:"name"`
	Address  string `json:"address"`
	Timezone string `json:"timezone"`
	Capacity int    `json:"capacity"`
	IsActive bool   `json:"isActive"`
}
