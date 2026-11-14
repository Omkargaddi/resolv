package handlers

import (
	"encoding/json"
	"net/http"
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
