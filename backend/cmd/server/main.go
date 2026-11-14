package main

import (
	"context"
	"errors"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	"github.com/go-chi/chi/v5"
	chimiddleware "github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
	"resolv-backend/internal/config"
	"resolv-backend/internal/database"
	"resolv-backend/internal/handlers"
	"resolv-backend/internal/middleware"
	"resolv-backend/internal/models"
	"resolv-backend/internal/notification"
	"resolv-backend/internal/queue"
	"resolv-backend/internal/redis"
	"resolv-backend/internal/services"
	"resolv-backend/internal/websocket"
)

var startTime = time.Now()

func main() {
	cfg, err := config.LoadConfig()
	if err != nil {
		log.Fatalf("[FATAL] Failed to load config: %v", err)
	}

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	// database
	db, err := database.NewDB(ctx, cfg)
	if err != nil {
		log.Fatalf("[FATAL] Database init failed: %v", err)
	}
	defer db.Close()

	// redis
	rdb, err := redis.NewClient(cfg)
	if err != nil {
		log.Fatalf("[FATAL] Redis init failed: %v", err)
	}
	defer func() { _ = rdb.Close() }()

	// notification Service
	notifier := notification.NewService()

	// webSocket Hub
	wsHub := websocket.GetHub()

	// Queue Service
	queueService, err := queue.NewService(cfg)
	if err != nil {
		log.Fatalf("[FATAL] Queue init failed: %v", err)
	}
	if err := queueService.StartWorkers(); err != nil {
		log.Printf("[WARN] Failed to start workers: %v", err)
	}
	defer queueService.Shutdown()

	// Services & Handlers
	authMgr := middleware.NewAuthManager(cfg)
	bookingService := services.NewBookingService(db, rdb, queueService, notifier, wsHub, cfg)

	authHandler := handlers.NewAuthHandler(db, authMgr)
	venueHandler := handlers.NewVenueHandler()
	slotHandler := handlers.NewSlotHandler(bookingService)
	bookingHandler := handlers.NewBookingHandler(bookingService)
	adminHandler := handlers.NewAdminHandler(queueService)

	// chi router
	r := chi.NewRouter()

	r.Use(chimiddleware.RequestID)
	r.Use(chimiddleware.RealIP)
	r.Use(middleware.RequestLogger)
	r.Use(chimiddleware.Recoverer)
	r.Use(chimiddleware.Compress(5))

	corsOrigins := []string{"*"}
	if cfg.CORSOrigin != "" && cfg.CORSOrigin != "*" {
		corsOrigins = strings.Split(cfg.CORSOrigin, ",")
	}

	r.Use(cors.Handler(cors.Options{
		AllowedOrigins:   corsOrigins,
		AllowedMethods:   []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Accept", "Authorization", "Content-Type", "X-CSRF-Token"},
		ExposedHeaders:   []string{"Link"},
		AllowCredentials: true,
		MaxAge:           300,
	}))

	// Health 
	r.Get("/health", func(w http.ResponseWriter, r *http.Request) {
		handlers.RenderJSON(w, http.StatusOK, map[string]interface{}{
			"status":    "ok",
			"uptime":    time.Since(startTime).Seconds(),
			"timestamp": time.Now().UTC().Format(time.RFC3339Nano),
		})
	})

	// webSockets
	r.Get("/ws", func(w http.ResponseWriter, r *http.Request) {
		websocket.ServeWS(wsHub, w, r)
	})

	// Routes
	r.Route("/api", func(api chi.Router) {
		// Auth
		api.Route("/auth", func(auth chi.Router) {
			auth.Post("/register", authHandler.Register)
			auth.Post("/login", authHandler.Login)
			auth.Post("/refresh", authHandler.Refresh)

			auth.Group(func(protected chi.Router) {
				protected.Use(authMgr.Authenticate)
				protected.Post("/logout", authHandler.Logout)
				protected.Get("/me", authHandler.GetMe)
				protected.Patch("/profile", authHandler.UpdateProfile)
			})
		})

		// Venue 
		api.Route("/venues", func(venues chi.Router) {
			venues.Get("/", venueHandler.GetVenues)
			venues.Get("/{id}", venueHandler.GetVenueByID)
			venues.Get("/{venueId}/slots", slotHandler.GetAvailableSlots)
		})

		// Slot
		api.Route("/slots", func(slots chi.Router) {
			slots.Get("/{id}", slotHandler.GetSlotByID)

			slots.Group(func(adminOnly chi.Router) {
				adminOnly.Use(authMgr.Authenticate)
				adminOnly.Use(middleware.AuthorizeRole(models.UserRoleAdmin))
				adminOnly.Post("/{id}/block", slotHandler.BlockSlot)
				adminOnly.Post("/{id}/unblock", slotHandler.UnblockSlot)
			})
		})

		// Booking
		api.Route("/bookings", func(bookings chi.Router) {
			bookings.Use(authMgr.Authenticate)
			bookings.Post("/", bookingHandler.CreateBooking)
			bookings.Get("/my", bookingHandler.GetMyBookings)
			bookings.Get("/code/{code}", bookingHandler.GetBookingByCode)
			bookings.Get("/{id}", bookingHandler.GetBookingByID)
			bookings.Post("/{id}/cancel", bookingHandler.CancelBooking)
		})

		// Admin
		api.Route("/admin", func(admin chi.Router) {
			admin.Use(authMgr.Authenticate)
			admin.Use(middleware.AuthorizeRole(models.UserRoleAdmin))
			admin.Get("/queue-stats", adminHandler.GetQueueStats)
		})
	})

	// 404
	r.NotFound(func(w http.ResponseWriter, r *http.Request) {
		handlers.RenderError(w, http.StatusNotFound, "Endpoint not found", "NOT_FOUND")
	})

	// HTTP Server
	serverAddr := fmt.Sprintf(":%s", cfg.Port)
	srv := &http.Server{
		Addr:    serverAddr,
		Handler: r,
	}

	go func() {
		log.Printf("[INFO] Resolv REST running at http://localhost:%s/api", cfg.Port)
		log.Printf("[INFO] WebSockets at ws://localhost:%s/ws", cfg.Port)
		log.Printf("[INFO] Health check at http://localhost:%s/health", cfg.Port)
		log.Printf("[INFO] Environment: %s", cfg.Env)

		if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			log.Fatalf("[FATAL] HTTP server ListenAndServe error: %v", err)
		}
	}()

	// shutdown
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	sig := <-quit
	log.Printf("[INFO] Received signal %v, starting graceful shutdown...", sig)

	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer shutdownCancel()

	if err := srv.Shutdown(shutdownCtx); err != nil {
		log.Printf("[ERROR] HTTP server shutdown error: %v", err)
	}

	log.Println("[INFO] Graceful shutdown complete")
}
