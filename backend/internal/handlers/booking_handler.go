package handlers

import (
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"
	"resolv-backend/internal/middleware"
	"resolv-backend/internal/models"
	"resolv-backend/internal/services"
)

type BookingHandler struct {
	bookingService *services.BookingService
}

func NewBookingHandler(bookingService *services.BookingService) *BookingHandler {
	return &BookingHandler{bookingService: bookingService}
}

type CreateBookingRequest struct {
	SlotID     string  `json:"slotId"`
	VenueID    string  `json:"venueId"`
	GuestCount int     `json:"guestCount"`
	Notes      *string `json:"notes,omitempty"`
}

type CancelBookingRequest struct {
	Reason *string `json:"reason,omitempty"`
}

type MyBookingsResponse struct {
	Data       []models.Booking `json:"data"`
	Pagination PaginationMeta   `json:"pagination"`
}

type PaginationMeta struct {
	Total           int  `json:"total"`
	Limit           int  `json:"limit"`
	Offset          int  `json:"offset"`
	HasNextPage     bool `json:"hasNextPage"`
	HasPreviousPage bool `json:"hasPreviousPage"`
}

func (h *BookingHandler) CreateBooking(w http.ResponseWriter, r *http.Request) {
	user := middleware.GetUserFromContext(r.Context())
	if user == nil {
		RenderError(w, http.StatusUnauthorized, "Authentication required", "UNAUTHORIZED")
		return
	}

	var req CreateBookingRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		RenderError(w, http.StatusBadRequest, "Invalid request body", "BAD_USER_INPUT")
		return
	}

	if req.SlotID == "" || req.VenueID == "" {
		RenderError(w, http.StatusBadRequest, "slotId and venueId are required", "BAD_USER_INPUT")
		return
	}

	booking, err := h.bookingService.CreateBooking(r.Context(), services.CreateBookingInput{
		UserID:     user.UserID,
		SlotID:     req.SlotID,
		VenueID:    req.VenueID,
		GuestCount: req.GuestCount,
		Notes:      req.Notes,
	})
	if err != nil {
		if bErr, ok := err.(*services.BookingError); ok {
			RenderError(w, bErr.StatusCode, bErr.Message, bErr.Code)
			return
		}
		RenderError(w, http.StatusInternalServerError, err.Error(), "INTERNAL_SERVER_ERROR")
		return
	}

	RenderJSON(w, http.StatusCreated, booking)
}

func (h *BookingHandler) GetMyBookings(w http.ResponseWriter, r *http.Request) {
	user := middleware.GetUserFromContext(r.Context())
	if user == nil {
		RenderError(w, http.StatusUnauthorized, "Authentication required", "UNAUTHORIZED")
		return
	}

	statusStr := r.URL.Query().Get("status")
	var status *models.BookingStatus
	if statusStr != "" {
		st := models.BookingStatus(statusStr)
		status = &st
	}

	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	if limit <= 0 {
		limit = 20
	}
	offset, _ := strconv.Atoi(r.URL.Query().Get("offset"))
	if offset < 0 {
		offset = 0
	}

	bookings, total, err := h.bookingService.GetBookingsByUser(r.Context(), user.UserID, status, limit, offset)
	if err != nil {
		RenderError(w, http.StatusInternalServerError, "Failed to retrieve bookings", "INTERNAL_SERVER_ERROR")
		return
	}

	RenderJSON(w, http.StatusOK, MyBookingsResponse{
		Data: bookings,
		Pagination: PaginationMeta{
			Total:           total,
			Limit:           limit,
			Offset:          offset,
			HasNextPage:     offset+limit < total,
			HasPreviousPage: offset > 0,
		},
	})
}

func (h *BookingHandler) GetBookingByID(w http.ResponseWriter, r *http.Request) {
	user := middleware.GetUserFromContext(r.Context())
	if user == nil {
		RenderError(w, http.StatusUnauthorized, "Authentication required", "UNAUTHORIZED")
		return
	}

	id := chi.URLParam(r, "id")
	booking, err := h.bookingService.GetBookingByID(r.Context(), id)
	if err != nil {
		RenderError(w, http.StatusInternalServerError, "Failed to retrieve booking", "INTERNAL_SERVER_ERROR")
		return
	}
	if booking == nil {
		RenderError(w, http.StatusNotFound, "Booking not found", "NOT_FOUND")
		return
	}

	if booking.UserID != user.UserID && user.Role != models.UserRoleAdmin {
		RenderError(w, http.StatusForbidden, "Not authorized to view this booking", "FORBIDDEN")
		return
	}

	RenderJSON(w, http.StatusOK, booking)
}

func (h *BookingHandler) GetBookingByCode(w http.ResponseWriter, r *http.Request) {
	user := middleware.GetUserFromContext(r.Context())
	if user == nil {
		RenderError(w, http.StatusUnauthorized, "Authentication required", "UNAUTHORIZED")
		return
	}

	code := chi.URLParam(r, "code")
	booking, err := h.bookingService.GetBookingByCode(r.Context(), code)
	if err != nil {
		RenderError(w, http.StatusInternalServerError, "Failed to retrieve booking", "INTERNAL_SERVER_ERROR")
		return
	}
	if booking == nil {
		RenderError(w, http.StatusNotFound, "Booking not found", "NOT_FOUND")
		return
	}

	if booking.UserID != user.UserID && user.Role != models.UserRoleAdmin {
		RenderError(w, http.StatusForbidden, "Not authorized to view this booking", "FORBIDDEN")
		return
	}

	RenderJSON(w, http.StatusOK, booking)
}

func (h *BookingHandler) CancelBooking(w http.ResponseWriter, r *http.Request) {
	user := middleware.GetUserFromContext(r.Context())
	if user == nil {
		RenderError(w, http.StatusUnauthorized, "Authentication required", "UNAUTHORIZED")
		return
	}

	id := chi.URLParam(r, "id")
	var req CancelBookingRequest
	_ = json.NewDecoder(r.Body).Decode(&req)

	booking, err := h.bookingService.CancelBooking(r.Context(), services.CancelBookingInput{
		BookingID: id,
		UserID:    user.UserID,
		UserRole:  user.Role,
		Reason:    req.Reason,
	})
	if err != nil {
		if bErr, ok := err.(*services.BookingError); ok {
			RenderError(w, bErr.StatusCode, bErr.Message, bErr.Code)
			return
		}
		RenderError(w, http.StatusInternalServerError, err.Error(), "INTERNAL_SERVER_ERROR")
		return
	}

	RenderJSON(w, http.StatusOK, booking)
}
