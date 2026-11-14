package middleware

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"resolv-backend/internal/config"
	"resolv-backend/internal/models"
)

func TestAuthTokenGenerationAndVerification(t *testing.T) {
	cfg := &config.Config{
		JWTSecret:        "test-super-secret-key-12345",
		JWTAccessExpiry:  1 * time.Hour,
		JWTRefreshExpiry: 24 * time.Hour,
	}

	authMgr := NewAuthManager(cfg)

	user := &models.User{
		ID:    "b4578119-94d3-4fc6-b7cf-54734ef52174",
		Email: "test@example.com",
		Role:  models.UserRoleMember,
	}

	accessToken, refreshToken, err := authMgr.GenerateTokens(user)
	if err != nil {
		t.Fatalf("unexpected error generating tokens: %v", err)
	}

	if accessToken == "" || refreshToken == "" {
		t.Fatalf("expected non-empty tokens")
	}

	payload, err := authMgr.VerifyAccessToken(accessToken)
	if err != nil {
		t.Fatalf("unexpected error verifying access token: %v", err)
	}

	if payload.UserID != user.ID {
		t.Errorf("expected user ID %s, got %s", user.ID, payload.UserID)
	}
	if payload.Email != user.Email {
		t.Errorf("expected email %s, got %s", user.Email, payload.Email)
	}
	if payload.Role != models.UserRoleMember {
		t.Errorf("expected role member, got %s", payload.Role)
	}

	refreshUserID, err := authMgr.VerifyRefreshToken(refreshToken)
	if err != nil {
		t.Fatalf("unexpected error verifying refresh token: %v", err)
	}
	if refreshUserID != user.ID {
		t.Errorf("expected refresh user ID %s, got %s", user.ID, refreshUserID)
	}
}

func TestExtractToken(t *testing.T) {
	req, _ := http.NewRequest("GET", "/", nil)
	req.Header.Set("Authorization", "Bearer my-secret-token")
	if token := ExtractToken(req); token != "my-secret-token" {
		t.Errorf("expected 'my-secret-token', got '%s'", token)
	}

	req.Header.Set("Authorization", "Basic xyz")
	if token := ExtractToken(req); token != "" {
		t.Errorf("expected empty token for Basic auth, got '%s'", token)
	}

	req.Header.Del("Authorization")
	if token := ExtractToken(req); token != "" {
		t.Errorf("expected empty token for missing header, got '%s'", token)
	}
}

func TestVerifyInvalidToken(t *testing.T) {
	cfg := &config.Config{
		JWTSecret:        "test-super-secret-key-12345",
		JWTAccessExpiry:  1 * time.Hour,
		JWTRefreshExpiry: 24 * time.Hour,
	}
	authMgr := NewAuthManager(cfg)

	_, err := authMgr.VerifyAccessToken("invalid.token.structure")
	if err == nil {
		t.Errorf("expected error when verifying invalid token")
	}
}

func TestAuthorizeRole(t *testing.T) {
	mw := AuthorizeRole(models.UserRoleAdmin)

	dummyHandler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	})

	// Missing user context -> 401
	req1, _ := http.NewRequest("GET", "/", nil)
	rec1 := httptest.NewRecorder()
	mw(dummyHandler).ServeHTTP(rec1, req1)
	if rec1.Code != http.StatusUnauthorized {
		t.Errorf("expected status 401, got %d", rec1.Code)
	}

	// Member role trying to access admin -> 403
	req2, _ := http.NewRequest("GET", "/", nil)
	ctx2 := context.WithValue(req2.Context(), UserContextKey, &AuthPayload{
		UserID: "user-123",
		Role:   models.UserRoleMember,
	})
	rec2 := httptest.NewRecorder()
	mw(dummyHandler).ServeHTTP(rec2, req2.WithContext(ctx2))
	if rec2.Code != http.StatusForbidden {
		t.Errorf("expected status 403, got %d", rec2.Code)
	}

	// Admin role -> 200
	req3, _ := http.NewRequest("GET", "/", nil)
	ctx3 := context.WithValue(req3.Context(), UserContextKey, &AuthPayload{
		UserID: "admin-123",
		Role:   models.UserRoleAdmin,
	})
	rec3 := httptest.NewRecorder()
	mw(dummyHandler).ServeHTTP(rec3, req3.WithContext(ctx3))
	if rec3.Code != http.StatusOK {
		t.Errorf("expected status 200, got %d", rec3.Code)
	}
}
