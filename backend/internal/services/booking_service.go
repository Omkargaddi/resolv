package services

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"time"

	"github.com/jackc/pgx/v5"
	"resolv-backend/internal/config"
	"resolv-backend/internal/database"
	"resolv-backend/internal/models"
	"resolv-backend/internal/notification"
	"resolv-backend/internal/queue"
	"resolv-backend/internal/redis"
	"resolv-backend/internal/websocket"
)

type BookingError struct {
	Message    string
	Code       string
	StatusCode int
}

func (e *BookingError) Error() string {
	return e.Message
}

func NewBookingError(msg, code string, status int) *BookingError {
	return &BookingError{
		Message:    msg,
		Code:       code,
		StatusCode: status,
	}
}

type CreateBookingInput struct {
	UserID     string
	SlotID     string
	VenueID    string
	GuestCount int
	Notes      *string
}

type CancelBookingInput struct {
	BookingID string
	UserID    string
	UserRole  models.UserRole
	Reason    *string
}

const (
	slotColumns = "id, venue_id, date::text, start_time, end_time, capacity, remaining_capacity, status, duration_minutes, price, currency, metadata, held_until, created_at, updated_at"

	bookingWithSlotColumns = `b.id, b.user_id, b.slot_id, b.venue_id, b.confirmation_code, b.status, b.guest_count, b.notes,
		b.booking_date::text, b.confirmed_at, b.cancelled_at, b.cancellation_reason, b.completed_at,
		b.total_price, b.metadata, b.created_at, b.updated_at,
		s.id, s.venue_id, s.date::text, s.start_time, s.end_time, s.capacity, s.remaining_capacity,
		s.status, s.duration_minutes, s.price, s.currency, s.metadata, s.held_until, s.created_at, s.updated_at`
)

type rowScanner interface {
	Scan(dest ...interface{}) error
}

func scanSlot(scanner rowScanner) (*models.Slot, error) {
	var slot models.Slot
	var price *float64
	var metadataBytes []byte
	var heldUntil *time.Time

	err := scanner.Scan(
		&slot.ID, &slot.VenueID, &slot.Date, &slot.StartTime, &slot.EndTime,
		&slot.Capacity, &slot.RemainingCapacity, &slot.Status, &slot.DurationMinutes,
		&price, &slot.Currency, &metadataBytes, &heldUntil,
		&slot.CreatedAt, &slot.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	slot.Price = price
	slot.HeldUntil = heldUntil
	if len(metadataBytes) > 0 {
		_ = json.Unmarshal(metadataBytes, &slot.Metadata)
	}
	return &slot, nil
}

func scanBookingWithSlot(scanner rowScanner) (*models.Booking, error) {
	var b models.Booking
	var notes, cancellationReason *string
	var confirmedAt, cancelledAt, completedAt *time.Time
	var totalPrice *float64
	var bMetaBytes []byte

	var sID, sVenueID, sDate, sCurrency *string
	var sStartTime, sEndTime, sCreatedAt, sUpdatedAt *time.Time
	var sCapacity, sRemaining, sDuration *int
	var sStatus *models.SlotStatus
	var sPrice *float64
	var sHeldUntil *time.Time
	var sMetaBytes []byte

	err := scanner.Scan(
		&b.ID, &b.UserID, &b.SlotID, &b.VenueID, &b.ConfirmationCode, &b.Status, &b.GuestCount, &notes,
		&b.BookingDate, &confirmedAt, &cancelledAt, &cancellationReason, &completedAt,
		&totalPrice, &bMetaBytes, &b.CreatedAt, &b.UpdatedAt,
		&sID, &sVenueID, &sDate, &sStartTime, &sEndTime, &sCapacity, &sRemaining,
		&sStatus, &sDuration, &sPrice, &sCurrency, &sMetaBytes, &sHeldUntil, &sCreatedAt, &sUpdatedAt,
	)
	if err != nil {
		return nil, err
	}

	b.Notes = notes
	b.ConfirmedAt = confirmedAt
	b.CancelledAt = cancelledAt
	b.CancellationReason = cancellationReason
	b.CompletedAt = completedAt
	b.TotalPrice = totalPrice
	if len(bMetaBytes) > 0 {
		_ = json.Unmarshal(bMetaBytes, &b.Metadata)
	}

	if sID != nil {
		slot := &models.Slot{
			ID:                *sID,
			VenueID:           *sVenueID,
			Date:              *sDate,
			StartTime:         *sStartTime,
			EndTime:           *sEndTime,
			Capacity:          *sCapacity,
			RemainingCapacity: *sRemaining,
			Status:            *sStatus,
			DurationMinutes:   *sDuration,
			Price:             sPrice,
			Currency:          *sCurrency,
			HeldUntil:         sHeldUntil,
			CreatedAt:         *sCreatedAt,
			UpdatedAt:         *sUpdatedAt,
		}
		if len(sMetaBytes) > 0 {
			_ = json.Unmarshal(sMetaBytes, &slot.Metadata)
		}
		b.Slot = slot
	}

	return &b, nil
}

type BookingService struct {
	db       *database.DB
	redis    *redis.Client
	queue    *queue.Service
	notifier *notification.Service
	wsHub    *websocket.Hub
	cfg      *config.Config
}

func NewBookingService(
	db *database.DB,
	rdb *redis.Client,
	q *queue.Service,
	n *notification.Service,
	hub *websocket.Hub,
	cfg *config.Config,
) *BookingService {
	return &BookingService{
		db:       db,
		redis:    rdb,
		queue:    q,
		notifier: n,
		wsHub:    hub,
		cfg:      cfg,
	}
}

func (s *BookingService) CreateBooking(ctx context.Context, input CreateBookingInput) (*models.Booking, error) {
	if input.GuestCount <= 0 {
		input.GuestCount = 1
	}

	// 1. Acquire Redis distributed lock
	lockKey := fmt.Sprintf("booking:slot:%s", input.SlotID)
	lockID, err := s.redis.AcquireLock(ctx, lockKey, 15*time.Second)
	if err != nil {
		return nil, err
	}
	if lockID == "" {
		return nil, NewBookingError("This slot is currently being processed. Please try again.", "SLOT_LOCKED", 409)
	}
	defer func() {
		_, _ = s.redis.ReleaseLock(context.Background(), lockKey, lockID)
	}()

	// 2. Serializable transaction
	tx, err := s.db.Pool.BeginTx(ctx, pgx.TxOptions{IsoLevel: pgx.Serializable})
	if err != nil {
		return nil, fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer func() {
		_ = tx.Rollback(ctx)
	}()

	// Verify user active
	var isActive bool
	err = tx.QueryRow(ctx, "SELECT is_active FROM users WHERE id = $1", input.UserID).Scan(&isActive)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, NewBookingError("User not found or inactive", "USER_NOT_FOUND", 404)
		}
		return nil, err
	}
	if !isActive {
		return nil, NewBookingError("User not found or inactive", "USER_NOT_FOUND", 404)
	}

	// Check active bookings limit
	var activeCount int
	err = tx.QueryRow(ctx, "SELECT count(*) FROM bookings WHERE user_id = $1 AND status = 'confirmed'", input.UserID).Scan(&activeCount)
	if err != nil {
		return nil, err
	}
	if activeCount >= s.cfg.MaxConcurrentBookingsPerUser {
		return nil, NewBookingError(
			fmt.Sprintf("Maximum concurrent bookings (%d) reached", s.cfg.MaxConcurrentBookingsPerUser),
			"MAX_BOOKINGS_REACHED",
			429,
		)
	}

	// Lock slot with SELECT ... FOR UPDATE
	slot, err := scanSlot(tx.QueryRow(ctx, "SELECT "+slotColumns+" FROM slots WHERE id = $1 FOR UPDATE", input.SlotID))
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, NewBookingError("Slot not found", "SLOT_NOT_FOUND", 404)
		}
		return nil, err
	}

	if slot.Status == models.SlotStatusBlocked {
		return nil, NewBookingError("This slot is not available for booking", "SLOT_BLOCKED", 400)
	}

	if !slot.CanAccommodate(input.GuestCount) {
		return nil, NewBookingError(
			fmt.Sprintf("Insufficient capacity. Available: %d, Requested: %d", slot.RemainingCapacity, input.GuestCount),
			"INSUFFICIENT_CAPACITY",
			400,
		)
	}

	if slot.IsPast() {
		return nil, NewBookingError("Cannot book a slot in the past", "SLOT_IN_PAST", 400)
	}

	maxDate := time.Now().AddDate(0, 0, s.cfg.MaxBookingAdvanceDays)
	if slot.StartTime.After(maxDate) {
		return nil, NewBookingError(
			fmt.Sprintf("Cannot book more than %d days in advance", s.cfg.MaxBookingAdvanceDays),
			"ADVANCE_LIMIT_EXCEEDED",
			400,
		)
	}

	// Check for duplicate confirmed booking for the same user and slot
	var duplicateCount int
	err = tx.QueryRow(ctx, "SELECT count(*) FROM bookings WHERE user_id = $1 AND slot_id = $2 AND status = 'confirmed'", input.UserID, input.SlotID).Scan(&duplicateCount)
	if err != nil {
		return nil, err
	}
	if duplicateCount > 0 {
		return nil, NewBookingError("You already have a booking for this slot", "DUPLICATE_BOOKING", 409)
	}

	var totalPrice *float64
	if slot.Price != nil {
		tp := *slot.Price * float64(input.GuestCount)
		totalPrice = &tp
	}

	confirmationCode := models.GenerateConfirmationCode()
	now := time.Now()

	insertBookingQuery := `
		INSERT INTO bookings (user_id, slot_id, venue_id, confirmation_code, status, guest_count, notes, booking_date, confirmed_at, total_price, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
		RETURNING id, created_at, updated_at
	`
	booking := &models.Booking{
		UserID:           input.UserID,
		SlotID:           input.SlotID,
		VenueID:          input.VenueID,
		ConfirmationCode: confirmationCode,
		Status:           models.BookingStatusConfirmed,
		GuestCount:       input.GuestCount,
		Notes:            input.Notes,
		BookingDate:      slot.Date,
		ConfirmedAt:      &now,
		TotalPrice:       totalPrice,
	}

	err = tx.QueryRow(ctx, insertBookingQuery,
		booking.UserID, booking.SlotID, booking.VenueID, booking.ConfirmationCode,
		booking.Status, booking.GuestCount, booking.Notes, booking.BookingDate,
		booking.ConfirmedAt, booking.TotalPrice, now, now,
	).Scan(&booking.ID, &booking.CreatedAt, &booking.UpdatedAt)
	if err != nil {
		return nil, fmt.Errorf("failed to insert booking: %w", err)
	}

	// Update slot capacity
	newRemaining := slot.RemainingCapacity - input.GuestCount
	newStatus := slot.Status
	if newRemaining == 0 {
		newStatus = models.SlotStatusBooked
	}

	_, err = tx.Exec(ctx, "UPDATE slots SET remaining_capacity = $1, status = $2, updated_at = $3 WHERE id = $4",
		newRemaining, newStatus, now, slot.ID)
	if err != nil {
		return nil, fmt.Errorf("failed to update slot: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("transaction commit failed: %w", err)
	}

	// Invalidate cache
	_ = s.redis.InvalidateSlotCache(ctx, input.VenueID, slot.Date)

	// Async queue job
	_ = s.queue.Enqueue(queue.TypeBookingConfirmed, map[string]interface{}{
		"bookingId":        booking.ID,
		"userId":           input.UserID,
		"confirmationCode": booking.ConfirmationCode,
	})

	// Async notification
	go s.notifier.Send(context.Background(), notification.NotificationPayload{
		Type:   notification.TypeBookingConfirmed,
		UserID: input.UserID,
		Data: map[string]interface{}{
			"bookingId":        booking.ID,
			"confirmationCode": booking.ConfirmationCode,
			"date":             slot.Date,
			"startTime":        slot.StartTime.Format(time.RFC3339),
		},
	})

	// Broadcast WebSockets
	s.wsHub.Broadcast("slotAvailabilityChanged", map[string]interface{}{
		"slotId":            slot.ID,
		"venueId":           slot.VenueID,
		"status":            newStatus,
		"remainingCapacity": newRemaining,
	})

	s.wsHub.Broadcast("bookingStatusChanged", map[string]interface{}{
		"bookingId":        booking.ID,
		"status":           booking.Status,
		"confirmationCode": booking.ConfirmationCode,
		"userId":           booking.UserID,
	})

	log.Printf("[INFO] Booking created: id=%s, code=%s, user=%s", booking.ID, booking.ConfirmationCode, booking.UserID)
	return booking, nil
}

func (s *BookingService) CancelBooking(ctx context.Context, input CancelBookingInput) (*models.Booking, error) {
	// Query booking
	var booking models.Booking
	var notes, cancellationReason *string
	var confirmedAt, cancelledAt, completedAt *time.Time
	var totalPrice *float64
	var metadataBytes []byte

	query := `
		SELECT id, user_id, slot_id, venue_id, confirmation_code, status, guest_count, notes, booking_date::text, confirmed_at, cancelled_at, cancellation_reason, completed_at, total_price, metadata, created_at, updated_at
		FROM bookings
		WHERE id = $1
	`
	err := s.db.Pool.QueryRow(ctx, query, input.BookingID).Scan(
		&booking.ID, &booking.UserID, &booking.SlotID, &booking.VenueID, &booking.ConfirmationCode,
		&booking.Status, &booking.GuestCount, &notes, &booking.BookingDate,
		&confirmedAt, &cancelledAt, &cancellationReason, &completedAt,
		&totalPrice, &metadataBytes, &booking.CreatedAt, &booking.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, NewBookingError("Booking not found", "BOOKING_NOT_FOUND", 404)
		}
		return nil, err
	}
	booking.Notes = notes
	booking.ConfirmedAt = confirmedAt
	booking.CancelledAt = cancelledAt
	booking.CancellationReason = cancellationReason
	booking.CompletedAt = completedAt
	booking.TotalPrice = totalPrice

	if booking.UserID != input.UserID && input.UserRole != models.UserRoleAdmin {
		return nil, NewBookingError("Not authorized to cancel this booking", "UNAUTHORIZED", 403)
	}

	if !booking.IsCancellable() {
		return nil, NewBookingError("This booking can no longer be cancelled", "CANCELLATION_NOT_ALLOWED", 400)
	}

	tx, err := s.db.Pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer func() {
		_ = tx.Rollback(ctx)
	}()

	now := time.Now()
	booking.Status = models.BookingStatusCancelled
	booking.CancelledAt = &now
	booking.CancellationReason = input.Reason

	_, err = tx.Exec(ctx, `
		UPDATE bookings
		SET status = $1, cancelled_at = $2, cancellation_reason = $3, updated_at = $4
		WHERE id = $5
	`, booking.Status, booking.CancelledAt, booking.CancellationReason, now, booking.ID)
	if err != nil {
		return nil, err
	}

	// Reclaim slot capacity
	var slot models.Slot
	err = tx.QueryRow(ctx, `
		SELECT id, venue_id, remaining_capacity, status
		FROM slots
		WHERE id = $1
		FOR UPDATE
	`, booking.SlotID).Scan(&slot.ID, &slot.VenueID, &slot.RemainingCapacity, &slot.Status)

	if err == nil {
		newRemaining := slot.RemainingCapacity + booking.GuestCount
		newStatus := slot.Status
		if slot.Status == models.SlotStatusBooked && newRemaining > 0 {
			newStatus = models.SlotStatusAvailable
		}

		_, err = tx.Exec(ctx, `
			UPDATE slots
			SET remaining_capacity = $1, status = $2, updated_at = $3
			WHERE id = $4
		`, newRemaining, newStatus, now, slot.ID)
		if err != nil {
			return nil, err
		}

		slot.RemainingCapacity = newRemaining
		slot.Status = newStatus
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}

	_ = s.redis.InvalidateSlotCache(ctx, booking.VenueID, booking.BookingDate)

	_ = s.queue.Enqueue(queue.TypeBookingCancelled, map[string]interface{}{
		"bookingId": booking.ID,
		"userId":    booking.UserID,
		"slotId":    booking.SlotID,
	})

	go s.notifier.Send(context.Background(), notification.NotificationPayload{
		Type:   notification.TypeBookingCancelled,
		UserID: booking.UserID,
		Data: map[string]interface{}{
			"bookingId":        booking.ID,
			"confirmationCode": booking.ConfirmationCode,
		},
	})

	if slot.ID != "" {
		s.wsHub.Broadcast("slotAvailabilityChanged", map[string]interface{}{
			"slotId":            slot.ID,
			"venueId":           slot.VenueID,
			"status":            slot.Status,
			"remainingCapacity": slot.RemainingCapacity,
		})
	}

	s.wsHub.Broadcast("bookingStatusChanged", map[string]interface{}{
		"bookingId":        booking.ID,
		"status":           booking.Status,
		"confirmationCode": booking.ConfirmationCode,
		"userId":           booking.UserID,
	})

	log.Printf("[INFO] Booking cancelled: id=%s, user=%s", booking.ID, booking.UserID)
	return &booking, nil
}

func (s *BookingService) GetAvailableSlots(ctx context.Context, venueID, date string) ([]models.Slot, error) {
	// Check Redis cache first
	cached, err := s.redis.GetSlotCache(ctx, venueID, date)
	if err == nil && cached != "" {
		var slots []models.Slot
		if err := json.Unmarshal([]byte(cached), &slots); err == nil {
			log.Printf("[DEBUG] Cache hit for available slots: venue=%s, date=%s", venueID, date)
			return slots, nil
		}
	}

	query := "SELECT " + slotColumns + " FROM slots WHERE venue_id = $1 AND date = $2 ORDER BY start_time ASC"
	rows, err := s.db.Pool.Query(ctx, query, venueID, date)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	slots := make([]models.Slot, 0)
	for rows.Next() {
		slot, err := scanSlot(rows)
		if err != nil {
			return nil, err
		}
		slots = append(slots, *slot)
	}

	data, err := json.Marshal(slots)
	if err == nil {
		_ = s.redis.SetSlotCache(ctx, venueID, date, string(data))
	}

	return slots, nil
}

func (s *BookingService) GetSlotByID(ctx context.Context, id string) (*models.Slot, error) {
	query := "SELECT " + slotColumns + " FROM slots WHERE id = $1"
	slot, err := scanSlot(s.db.Pool.QueryRow(ctx, query, id))
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}
	return slot, nil
}

func (s *BookingService) updateSlotAndBroadcast(ctx context.Context, slot *models.Slot) error {
	metadataBytes, _ := json.Marshal(slot.Metadata)
	now := time.Now()
	_, err := s.db.Pool.Exec(ctx, `
		UPDATE slots
		SET status = $1, metadata = $2, updated_at = $3
		WHERE id = $4
	`, slot.Status, metadataBytes, now, slot.ID)
	if err != nil {
		return err
	}

	_ = s.redis.InvalidateSlotCache(ctx, slot.VenueID, slot.Date)

	s.wsHub.Broadcast("slotAvailabilityChanged", map[string]interface{}{
		"slotId":            slot.ID,
		"venueId":           slot.VenueID,
		"status":            slot.Status,
		"remainingCapacity": slot.RemainingCapacity,
	})
	return nil
}

func (s *BookingService) BlockSlot(ctx context.Context, slotID, adminID, reason string) (*models.Slot, error) {
	slot, err := s.GetSlotByID(ctx, slotID)
	if err != nil {
		return nil, err
	}
	if slot == nil {
		return nil, NewBookingError("Slot not found", "NOT_FOUND", 404)
	}

	if slot.Metadata == nil {
		slot.Metadata = make(map[string]interface{})
	}
	slot.Metadata["blockReason"] = reason
	slot.Metadata["blockedBy"] = adminID
	slot.Status = models.SlotStatusBlocked

	if err := s.updateSlotAndBroadcast(ctx, slot); err != nil {
		return nil, err
	}
	return slot, nil
}

func (s *BookingService) UnblockSlot(ctx context.Context, slotID, adminID string) (*models.Slot, error) {
	slot, err := s.GetSlotByID(ctx, slotID)
	if err != nil {
		return nil, err
	}
	if slot == nil {
		return nil, NewBookingError("Slot not found", "NOT_FOUND", 404)
	}

	if slot.RemainingCapacity > 0 {
		slot.Status = models.SlotStatusAvailable
	} else {
		slot.Status = models.SlotStatusBooked
	}

	if slot.Metadata != nil {
		delete(slot.Metadata, "blockReason")
		delete(slot.Metadata, "blockedBy")
	}

	if err := s.updateSlotAndBroadcast(ctx, slot); err != nil {
		return nil, err
	}
	return slot, nil
}

func (s *BookingService) GetBookingByID(ctx context.Context, id string) (*models.Booking, error) {
	return s.getBooking(ctx, "id = $1", id)
}

func (s *BookingService) GetBookingByCode(ctx context.Context, code string) (*models.Booking, error) {
	return s.getBooking(ctx, "confirmation_code = $1", code)
}

func (s *BookingService) getBooking(ctx context.Context, whereClause string, arg interface{}) (*models.Booking, error) {
	query := fmt.Sprintf(`
		SELECT %s
		FROM bookings b
		LEFT JOIN slots s ON b.slot_id = s.id
		WHERE b.%s
	`, bookingWithSlotColumns, whereClause)

	booking, err := scanBookingWithSlot(s.db.Pool.QueryRow(ctx, query, arg))
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}
	return booking, nil
}

func (s *BookingService) GetBookingsByUser(
	ctx context.Context,
	userID string,
	status *models.BookingStatus,
	limit, offset int,
) ([]models.Booking, int, error) {
	if limit <= 0 {
		limit = 20
	}
	if offset < 0 {
		offset = 0
	}

	countQuery := "SELECT count(*) FROM bookings WHERE user_id = $1"
	argsCount := []interface{}{userID}
	if status != nil && *status != "" {
		countQuery += " AND status = $2"
		argsCount = append(argsCount, *status)
	}

	var total int
	if err := s.db.Pool.QueryRow(ctx, countQuery, argsCount...).Scan(&total); err != nil {
		return nil, 0, err
	}

	selectQuery := fmt.Sprintf(`
		SELECT %s
		FROM bookings b
		LEFT JOIN slots s ON b.slot_id = s.id
		WHERE b.user_id = $1
	`, bookingWithSlotColumns)
	argsSelect := []interface{}{userID}
	argIdx := 2
	if status != nil && *status != "" {
		selectQuery += fmt.Sprintf(" AND b.status = $%d", argIdx)
		argsSelect = append(argsSelect, *status)
		argIdx++
	}

	selectQuery += fmt.Sprintf(" ORDER BY b.created_at DESC LIMIT $%d OFFSET $%d", argIdx, argIdx+1)
	argsSelect = append(argsSelect, limit, offset)

	rows, err := s.db.Pool.Query(ctx, selectQuery, argsSelect...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	bookings := make([]models.Booking, 0)
	for rows.Next() {
		booking, err := scanBookingWithSlot(rows)
		if err != nil {
			return nil, 0, err
		}
		bookings = append(bookings, *booking)
	}

	return bookings, total, nil
}
