package handlers

import (
	"encoding/json"
	"errors"
	"net/http"

	"resolv-backend/internal/services"
)

type ErrorResponse struct {
	Error string `json:"error"`
	Code  string `json:"code"`
}

func RenderJSON(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(data)
}

func RenderError(w http.ResponseWriter, status int, message, code string) {
	RenderJSON(w, status, ErrorResponse{
		Error: message,
		Code:  code,
	})
}

func RenderServiceError(w http.ResponseWriter, err error, defaultMsg string) {
	var bErr *services.BookingError
	if errors.As(err, &bErr) {
		RenderError(w, bErr.StatusCode, bErr.Message, bErr.Code)
		return
	}
	RenderError(w, http.StatusInternalServerError, defaultMsg, "INTERNAL_SERVER_ERROR")
}
