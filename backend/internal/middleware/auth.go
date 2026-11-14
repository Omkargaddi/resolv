package middleware

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"slices"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"resolv-backend/internal/config"
	"resolv-backend/internal/models"
)

type contextKey string

const UserContextKey contextKey = "authUser"

type AuthPayload struct {
	UserID string          `json:"userId"`
	Email  string          `json:"email"`
	Role   models.UserRole `json:"role"`
}

type CustomClaims struct {
	UserID    string          `json:"userId"`
	Email     string          `json:"email"`
	Role      models.UserRole `json:"role"`
	TokenType string          `json:"tokenType,omitempty"`
	jwt.RegisteredClaims
}

type AuthManager struct {
	cfg *config.Config
}

func NewAuthManager(cfg *config.Config) *AuthManager {
	return &AuthManager{cfg: cfg}
}

func (a *AuthManager) GenerateTokens(user *models.User) (string, string, error) {
	now := time.Now()

	accessClaims := CustomClaims{
		UserID: user.ID,
		Email:  user.Email,
		Role:   user.Role,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(now.Add(a.cfg.JWTAccessExpiry)),
			IssuedAt:  jwt.NewNumericDate(now),
			Issuer:    "reserve-api",
			Audience:  jwt.ClaimStrings{"reserve-client"},
		},
	}

	accessTokenObj := jwt.NewWithClaims(jwt.SigningMethodHS256, accessClaims)
	accessToken, err := accessTokenObj.SignedString([]byte(a.cfg.JWTSecret))
	if err != nil {
		return "", "", err
	}

	refreshClaims := CustomClaims{
		UserID:    user.ID,
		TokenType: "refresh",
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(now.Add(a.cfg.JWTRefreshExpiry)),
			IssuedAt:  jwt.NewNumericDate(now),
			Issuer:    "reserve-api",
		},
	}

	refreshTokenObj := jwt.NewWithClaims(jwt.SigningMethodHS256, refreshClaims)
	refreshToken, err := refreshTokenObj.SignedString([]byte(a.cfg.JWTSecret))
	if err != nil {
		return "", "", err
	}

	return accessToken, refreshToken, nil
}

func (a *AuthManager) parseTokenClaims(tokenString string, options ...jwt.ParserOption) (*CustomClaims, error) {
	token, err := jwt.ParseWithClaims(tokenString, &CustomClaims{}, func(t *jwt.Token) (interface{}, error) {
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", t.Header["alg"])
		}
		return []byte(a.cfg.JWTSecret), nil
	}, options...)
	if err != nil {
		return nil, err
	}

	claims, ok := token.Claims.(*CustomClaims)
	if !ok || !token.Valid {
		return nil, errors.New("invalid token claims")
	}
	return claims, nil
}

func (a *AuthManager) VerifyAccessToken(tokenString string) (*AuthPayload, error) {
	claims, err := a.parseTokenClaims(tokenString, jwt.WithIssuer("reserve-api"), jwt.WithAudience("reserve-client"))
	if err != nil {
		return nil, err
	}

	return &AuthPayload{
		UserID: claims.UserID,
		Email:  claims.Email,
		Role:   claims.Role,
	}, nil
}

func (a *AuthManager) VerifyRefreshToken(tokenString string) (string, error) {
	claims, err := a.parseTokenClaims(tokenString, jwt.WithIssuer("reserve-api"))
	if err != nil {
		return "", err
	}
	if claims.TokenType != "refresh" {
		return "", errors.New("invalid refresh token")
	}

	return claims.UserID, nil
}

func ExtractToken(r *http.Request) string {
	authHeader := r.Header.Get("Authorization")
	if authHeader == "" {
		return ""
	}
	parts := strings.SplitN(authHeader, " ", 2)
	if len(parts) == 2 && strings.EqualFold(parts[0], "Bearer") {
		return parts[1]
	}
	return ""
}

func (a *AuthManager) Authenticate(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		tokenStr := ExtractToken(r)
		if tokenStr == "" {
			writeJSONError(w, http.StatusUnauthorized, "Authentication required", "UNAUTHORIZED")
			return
		}

		payload, err := a.VerifyAccessToken(tokenStr)
		if err != nil {
			if errors.Is(err, jwt.ErrTokenExpired) {
				writeJSONError(w, http.StatusUnauthorized, "Token expired", "TOKEN_EXPIRED")
				return
			}
			writeJSONError(w, http.StatusUnauthorized, "Invalid token", "INVALID_TOKEN")
			return
		}

		ctx := context.WithValue(r.Context(), UserContextKey, payload)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

func AuthorizeRole(roles ...models.UserRole) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			user, ok := r.Context().Value(UserContextKey).(*AuthPayload)
			if !ok || user == nil {
				writeJSONError(w, http.StatusUnauthorized, "Authentication required", "UNAUTHORIZED")
				return
			}

			if !slices.Contains(roles, user.Role) {
				rolesStr := make([]string, len(roles))
				for i, r := range roles {
					rolesStr[i] = string(r)
				}
				writeJSONError(w, http.StatusForbidden, fmt.Sprintf("Insufficient permissions. Required: %s", strings.Join(rolesStr, " or ")), "FORBIDDEN")
				return
			}

			next.ServeHTTP(w, r)
		})
	}
}

func GetUserFromContext(ctx context.Context) *AuthPayload {
	if u, ok := ctx.Value(UserContextKey).(*AuthPayload); ok {
		return u
	}
	return nil
}

func writeJSONError(w http.ResponseWriter, status int, message, code string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(map[string]string{
		"error": message,
		"code":  code,
	})
}
