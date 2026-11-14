package services

import (
	"encoding/json"
	"testing"
	"time"

	"resolv-backend/internal/models"
)

type mockRowScanner struct {
	values []interface{}
}

func (m *mockRowScanner) Scan(dest ...interface{}) error {
	for i, v := range m.values {
		if i >= len(dest) {
			break
		}
		switch d := dest[i].(type) {
		case *string:
			if v != nil {
				*d = v.(string)
			}
		case **string:
			if v != nil {
				s := v.(string)
				*d = &s
			}
		case *time.Time:
			if v != nil {
				*d = v.(time.Time)
			}
		case **time.Time:
			if v != nil {
				t := v.(time.Time)
				*d = &t
			}
		case *int:
			if v != nil {
				*d = v.(int)
			}
		case **int:
			if v != nil {
				n := v.(int)
				*d = &n
			}
		case *models.SlotStatus:
			if v != nil {
				*d = v.(models.SlotStatus)
			}
		case **models.SlotStatus:
			if v != nil {
				st := v.(models.SlotStatus)
				*d = &st
			}
		case **float64:
			if v != nil {
				f := v.(float64)
				*d = &f
			}
		case *[]byte:
			if v != nil {
				*d = v.([]byte)
			}
		}
	}
	return nil
}

func TestScanSlot(t *testing.T) {
	now := time.Now()
	metaJSON, _ := json.Marshal(map[string]interface{}{"court": 1})
	mock := &mockRowScanner{
		values: []interface{}{
			"slot-123",                            // ID
			"venue-456",                           // VenueID
			"2026-11-15",                          // Date
			now,                                   // StartTime
			now.Add(1 * time.Hour),                // EndTime
			4,                                     // Capacity
			3,                                     // RemainingCapacity
			models.SlotStatusAvailable,            // Status
			60,                                    // DurationMinutes
			25.50,                                 // Price
			"USD",                                 // Currency
			metaJSON,                              // Metadata
			nil,                                   // HeldUntil
			now,                                   // CreatedAt
			now,                                   // UpdatedAt
		},
	}

	slot, err := scanSlot(mock)
	if err != nil {
		t.Fatalf("unexpected scanSlot error: %v", err)
	}
	if slot.ID != "slot-123" {
		t.Errorf("expected slot ID 'slot-123', got '%s'", slot.ID)
	}
	if slot.RemainingCapacity != 3 {
		t.Errorf("expected capacity 3, got %d", slot.RemainingCapacity)
	}
	if slot.Price == nil || *slot.Price != 25.50 {
		t.Errorf("expected price 25.50, got %v", slot.Price)
	}
	if slot.Metadata["court"] != float64(1) {
		t.Errorf("expected metadata court 1, got %v", slot.Metadata["court"])
	}
}

func TestBookingError(t *testing.T) {
	err := NewBookingError("Invalid reservation", "INVALID_RES", 400)
	if err.Error() != "Invalid reservation" {
		t.Errorf("expected 'Invalid reservation', got '%s'", err.Error())
	}
	if err.StatusCode != 400 || err.Code != "INVALID_RES" {
		t.Errorf("unexpected booking error fields: %+v", err)
	}
}
