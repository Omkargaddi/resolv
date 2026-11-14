package handlers

import (
	"net/http"

	"github.com/go-chi/chi/v5"
	"resolv-backend/internal/models"
)

type VenueHandler struct{}

func NewVenueHandler() *VenueHandler {
	return &VenueHandler{}
}

var defaultVenue = models.Venue{
	ID:       "11111111-1111-1111-1111-111111111111",
	Name:     "Main Hall",
	Address:  "100 Reservation Way, City Center",
	Timezone: "UTC",
	Capacity: 100,
	IsActive: true,
}

func (h *VenueHandler) GetVenues(w http.ResponseWriter, r *http.Request) {
	RenderJSON(w, http.StatusOK, []models.Venue{defaultVenue})
}

func (h *VenueHandler) GetVenueByID(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	venue := defaultVenue
	if id != "" {
		venue.ID = id
	}
	RenderJSON(w, http.StatusOK, venue)
}
