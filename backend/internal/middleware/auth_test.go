package middleware

import (
	"net/http"
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
