package handlers

import (
	"net/http"

	"resolv-backend/internal/queue"
)

type AdminHandler struct {
	queueService *queue.Service
}

func NewAdminHandler(queueService *queue.Service) *AdminHandler {
	return &AdminHandler{queueService: queueService}
}

func (h *AdminHandler) GetQueueStats(w http.ResponseWriter, r *http.Request) {
	stats, err := h.queueService.GetQueueStats()
	if err != nil {
		RenderError(w, http.StatusInternalServerError, "Failed to retrieve queue statistics", "INTERNAL_SERVER_ERROR")
		return
	}
	RenderJSON(w, http.StatusOK, stats)
}
