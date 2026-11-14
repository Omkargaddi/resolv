package handlers

import (
	"encoding/json"
	"net/http"

	"github.com/go-chi/chi/v5"
	"resolv-backend/internal/middleware"
	"resolv-backend/internal/services"
)

type SlotHandler struct {
	bookingService *services.BookingService
}

func NewSlotHandler(bookingService *services.BookingService) *SlotHandler {
	return &SlotHandler{bookingService: bookingService}
}

type BlockSlotRequest struct {
	Reason string `json:"reason"`
}

func (h *SlotHandler) GetAvailableSlots(w http.ResponseWriter, r *http.Request) {
	venueID := chi.URLParam(r, "venueId")
	date := r.URL.Query().Get("date")

	if venueID == "" || date == "" {
		RenderError(w, http.StatusBadRequest, "venueId param and date query parameter (YYYY-MM-DD) are required", "BAD_USER_INPUT")
		return
	}

	slots, err := h.bookingService.GetAvailableSlots(r.Context(), venueID, date)
	if err != nil {
		RenderError(w, http.StatusInternalServerError, "Failed to retrieve available slots", "INTERNAL_SERVER_ERROR")
		return
	}

	RenderJSON(w, http.StatusOK, slots)
}

func (h *SlotHandler) GetSlotByID(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	slot, err := h.bookingService.GetSlotByID(r.Context(), id)
	if err != nil {
		RenderError(w, http.StatusInternalServerError, "Failed to retrieve slot", "INTERNAL_SERVER_ERROR")
		return
	}
	if slot == nil {
		RenderError(w, http.StatusNotFound, "Slot not found", "NOT_FOUND")
		return
	}

	RenderJSON(w, http.StatusOK, slot)
}

func (h *SlotHandler) BlockSlot(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	user := middleware.GetUserFromContext(r.Context())

	var req BlockSlotRequest
	_ = json.NewDecoder(r.Body).Decode(&req)
	if req.Reason == "" {
		req.Reason = "Administrative block"
	}

	slot, err := h.bookingService.BlockSlot(r.Context(), id, user.UserID, req.Reason)
	if err != nil {
		RenderServiceError(w, err, "Failed to block slot")
		return
	}

	RenderJSON(w, http.StatusOK, slot)
}

func (h *SlotHandler) UnblockSlot(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	user := middleware.GetUserFromContext(r.Context())

	slot, err := h.bookingService.UnblockSlot(r.Context(), id, user.UserID)
	if err != nil {
		RenderServiceError(w, err, "Failed to unblock slot")
		return
	}

	RenderJSON(w, http.StatusOK, slot)
}
