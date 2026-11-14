package handlers

import (
	"encoding/json"
	"errors"
	"log"
	"net/http"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"resolv-backend/internal/database"
	"resolv-backend/internal/middleware"
	"resolv-backend/internal/models"
)

type AuthHandler struct {
	db          *database.DB
	authManager *middleware.AuthManager
}

func NewAuthHandler(db *database.DB, authManager *middleware.AuthManager) *AuthHandler {
	return &AuthHandler{
		db:          db,
		authManager: authManager,
	}
}

type RegisterRequest struct {
	Name     string  `json:"name"`
	Email    string  `json:"email"`
	Password string  `json:"password"`
	Phone    *string `json:"phone,omitempty"`
}

type LoginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

type RefreshRequest struct {
	RefreshToken string `json:"refreshToken"`
}

type UpdateProfileRequest struct {
	Name  *string `json:"name,omitempty"`
	Phone *string `json:"phone,omitempty"`
}

type AuthResponse struct {
	AccessToken  string       `json:"accessToken"`
	RefreshToken string       `json:"refreshToken"`
	User         *models.User `json:"user"`
}

func (h *AuthHandler) Register(w http.ResponseWriter, r *http.Request) {
	var req RegisterRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		RenderError(w, http.StatusBadRequest, "Invalid request body", "BAD_USER_INPUT")
		return
	}

	req.Email = strings.ToLower(strings.TrimSpace(req.Email))
	req.Name = strings.TrimSpace(req.Name)

	if req.Name == "" || req.Email == "" || req.Password == "" {
		RenderError(w, http.StatusBadRequest, "Name, email, and password are required", "BAD_USER_INPUT")
		return
	}

	// Check if existing user
	var existingID string
	err := h.db.Pool.QueryRow(r.Context(), "SELECT id FROM users WHERE email = $1", req.Email).Scan(&existingID)
	if err == nil {
		RenderError(w, http.StatusConflict, "An account with this email already exists", "CONFLICT")
		return
	} else if !errors.Is(err, pgx.ErrNoRows) {
		log.Printf("[ERROR] Database check failed: %v", err)
		RenderError(w, http.StatusInternalServerError, "An unexpected error occurred during registration", "INTERNAL_SERVER_ERROR")
		return
	}

	user := &models.User{
		Name:     req.Name,
		Email:    req.Email,
		Phone:    req.Phone,
		Role:     models.UserRoleMember,
		IsActive: true,
	}

	if err := user.HashPassword(req.Password); err != nil {
		log.Printf("[ERROR] Password hashing failed: %v", err)
		RenderError(w, http.StatusInternalServerError, "Failed to process password", "INTERNAL_SERVER_ERROR")
		return
	}

	now := time.Now()
	query := `
		INSERT INTO users (name, email, password, phone, role, is_active, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
		RETURNING id, created_at, updated_at
	`
	err = h.db.Pool.QueryRow(r.Context(), query,
		user.Name, user.Email, user.Password, user.Phone,
		user.Role, user.IsActive, now, now,
	).Scan(&user.ID, &user.CreatedAt, &user.UpdatedAt)
	if err != nil {
		log.Printf("[ERROR] User insertion failed: %v", err)
		RenderError(w, http.StatusInternalServerError, "An unexpected error occurred during registration", "INTERNAL_SERVER_ERROR")
		return
	}

	accessToken, refreshToken, err := h.authManager.GenerateTokens(user)
	if err != nil {
		log.Printf("[ERROR] Token generation failed: %v", err)
		RenderError(w, http.StatusInternalServerError, "Failed to generate tokens", "INTERNAL_SERVER_ERROR")
		return
	}

	_, _ = h.db.Pool.Exec(r.Context(), "UPDATE users SET refresh_token = $1 WHERE id = $2", refreshToken, user.ID)

	RenderJSON(w, http.StatusCreated, AuthResponse{
		AccessToken:  accessToken,
		RefreshToken: refreshToken,
		User:         user,
	})
}

func (h *AuthHandler) Login(w http.ResponseWriter, r *http.Request) {
	var req LoginRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		RenderError(w, http.StatusBadRequest, "Invalid request body", "BAD_USER_INPUT")
		return
	}

	req.Email = strings.ToLower(strings.TrimSpace(req.Email))
	if req.Email == "" || req.Password == "" {
		RenderError(w, http.StatusBadRequest, "Email and password are required", "BAD_USER_INPUT")
		return
	}

	var user models.User
	var phone, refreshToken *string
	var lastLoginAt *time.Time

	query := `
		SELECT id, name, email, password, phone, role, is_active, refresh_token, last_login_at, created_at, updated_at
		FROM users
		WHERE email = $1 AND is_active = true
	`
	err := h.db.Pool.QueryRow(r.Context(), query, req.Email).Scan(
		&user.ID, &user.Name, &user.Email, &user.Password, &phone,
		&user.Role, &user.IsActive, &refreshToken, &lastLoginAt,
		&user.CreatedAt, &user.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			RenderError(w, http.StatusUnauthorized, "Invalid email or password", "UNAUTHORIZED")
			return
		}
		log.Printf("[ERROR] Login query failed: %v", err)
		RenderError(w, http.StatusInternalServerError, "An unexpected error occurred during login", "INTERNAL_SERVER_ERROR")
		return
	}
	user.Phone = phone

	if !user.ComparePassword(req.Password) {
		RenderError(w, http.StatusUnauthorized, "Invalid email or password", "UNAUTHORIZED")
		return
	}

	accessToken, newRefreshToken, err := h.authManager.GenerateTokens(&user)
	if err != nil {
		log.Printf("[ERROR] Token generation failed: %v", err)
		RenderError(w, http.StatusInternalServerError, "Failed to generate tokens", "INTERNAL_SERVER_ERROR")
		return
	}

	now := time.Now()
	_, _ = h.db.Pool.Exec(r.Context(), "UPDATE users SET refresh_token = $1, last_login_at = $2 WHERE id = $3",
		newRefreshToken, now, user.ID)
	user.LastLoginAt = &now

	RenderJSON(w, http.StatusOK, AuthResponse{
		AccessToken:  accessToken,
		RefreshToken: newRefreshToken,
		User:         &user,
	})
}

func (h *AuthHandler) Refresh(w http.ResponseWriter, r *http.Request) {
	var req RefreshRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.RefreshToken == "" {
		RenderError(w, http.StatusBadRequest, "Refresh token is required", "BAD_USER_INPUT")
		return
	}

	userID, err := h.authManager.VerifyRefreshToken(req.RefreshToken)
	if err != nil {
		RenderError(w, http.StatusUnauthorized, "Invalid or expired refresh token", "UNAUTHORIZED")
		return
	}

	var user models.User
	var phone, storedRefreshToken *string
	var lastLoginAt *time.Time

	query := `
		SELECT id, name, email, password, phone, role, is_active, refresh_token, last_login_at, created_at, updated_at
		FROM users
		WHERE id = $1 AND is_active = true
	`
	err = h.db.Pool.QueryRow(r.Context(), query, userID).Scan(
		&user.ID, &user.Name, &user.Email, &user.Password, &phone,
		&user.Role, &user.IsActive, &storedRefreshToken, &lastLoginAt,
		&user.CreatedAt, &user.UpdatedAt,
	)
	if err != nil || storedRefreshToken == nil || *storedRefreshToken != req.RefreshToken {
		RenderError(w, http.StatusUnauthorized, "Invalid or expired refresh token", "UNAUTHORIZED")
		return
	}

	accessToken, newRefreshToken, err := h.authManager.GenerateTokens(&user)
	if err != nil {
		RenderError(w, http.StatusInternalServerError, "Failed to generate tokens", "INTERNAL_SERVER_ERROR")
		return
	}

	_, _ = h.db.Pool.Exec(r.Context(), "UPDATE users SET refresh_token = $1 WHERE id = $2", newRefreshToken, user.ID)

	RenderJSON(w, http.StatusOK, map[string]string{
		"accessToken":  accessToken,
		"refreshToken": newRefreshToken,
	})
}

func (h *AuthHandler) Logout(w http.ResponseWriter, r *http.Request) {
	userPayload := middleware.GetUserFromContext(r.Context())
	if userPayload != nil {
		_, _ = h.db.Pool.Exec(r.Context(), "UPDATE users SET refresh_token = NULL WHERE id = $1", userPayload.UserID)
	}
	RenderJSON(w, http.StatusOK, map[string]bool{"success": true})
}

func (h *AuthHandler) GetMe(w http.ResponseWriter, r *http.Request) {
	userPayload := middleware.GetUserFromContext(r.Context())
	if userPayload == nil {
		RenderError(w, http.StatusUnauthorized, "Authentication required", "UNAUTHORIZED")
		return
	}

	var user models.User
	var phone *string
	var lastLoginAt *time.Time

	query := `
		SELECT id, name, email, phone, role, is_active, last_login_at, created_at, updated_at
		FROM users
		WHERE id = $1
	`
	err := h.db.Pool.QueryRow(r.Context(), query, userPayload.UserID).Scan(
		&user.ID, &user.Name, &user.Email, &phone, &user.Role, &user.IsActive,
		&lastLoginAt, &user.CreatedAt, &user.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			RenderError(w, http.StatusNotFound, "User not found", "NOT_FOUND")
			return
		}
		RenderError(w, http.StatusInternalServerError, "An unexpected error occurred", "INTERNAL_SERVER_ERROR")
		return
	}
	user.Phone = phone
	user.LastLoginAt = lastLoginAt

	RenderJSON(w, http.StatusOK, user)
}

func (h *AuthHandler) UpdateProfile(w http.ResponseWriter, r *http.Request) {
	userPayload := middleware.GetUserFromContext(r.Context())
	if userPayload == nil {
		RenderError(w, http.StatusUnauthorized, "Authentication required", "UNAUTHORIZED")
		return
	}

	var req UpdateProfileRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		RenderError(w, http.StatusBadRequest, "Invalid request body", "BAD_USER_INPUT")
		return
	}

	if req.Name != nil {
		_, _ = h.db.Pool.Exec(r.Context(), "UPDATE users SET name = $1, updated_at = NOW() WHERE id = $2", *req.Name, userPayload.UserID)
	}
	if req.Phone != nil {
		_, _ = h.db.Pool.Exec(r.Context(), "UPDATE users SET phone = $1, updated_at = NOW() WHERE id = $2", *req.Phone, userPayload.UserID)
	}

	h.GetMe(w, r)
}
