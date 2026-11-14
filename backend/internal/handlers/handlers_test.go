package handlers

import (
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"resolv-backend/internal/services"
)

func TestRenderServiceError(t *testing.T) {
	// 1. With BookingError
	rec1 := httptest.NewRecorder()
	bErr := services.NewBookingError("Slot locked", "SLOT_LOCKED", http.StatusConflict)
	RenderServiceError(rec1, bErr, "Default fallback")

	if rec1.Code != http.StatusConflict {
		t.Errorf("expected status %d, got %d", http.StatusConflict, rec1.Code)
	}
	var res1 ErrorResponse
	if err := json.Unmarshal(rec1.Body.Bytes(), &res1); err != nil {
		t.Fatalf("failed to parse json response: %v", err)
	}
	if res1.Error != "Slot locked" || res1.Code != "SLOT_LOCKED" {
		t.Errorf("unexpected error payload: %+v", res1)
	}

	// 2. With generic error
	rec2 := httptest.NewRecorder()
	genericErr := errors.New("db connection closed")
	RenderServiceError(rec2, genericErr, "Something went wrong")

	if rec2.Code != http.StatusInternalServerError {
		t.Errorf("expected status %d, got %d", http.StatusInternalServerError, rec2.Code)
	}
	var res2 ErrorResponse
	if err := json.Unmarshal(rec2.Body.Bytes(), &res2); err != nil {
		t.Fatalf("failed to parse json response: %v", err)
	}
	if res2.Error != "Something went wrong" || res2.Code != "INTERNAL_SERVER_ERROR" {
		t.Errorf("unexpected error payload: %+v", res2)
	}
}

func TestParsePagination(t *testing.T) {
	req1, _ := http.NewRequest("GET", "/test?limit=50&offset=10", nil)
	limit1, offset1 := parsePagination(req1)
	if limit1 != 50 || offset1 != 10 {
		t.Errorf("expected limit=50, offset=10; got limit=%d, offset=%d", limit1, offset1)
	}

	req2, _ := http.NewRequest("GET", "/test?limit=-5&offset=-1", nil)
	limit2, offset2 := parsePagination(req2)
	if limit2 != 20 || offset2 != 0 {
		t.Errorf("expected defaults limit=20, offset=0; got limit=%d, offset=%d", limit2, offset2)
	}
}
