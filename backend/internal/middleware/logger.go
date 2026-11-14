package middleware

import (
	"log"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5/middleware"
)

func RequestLogger(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		ww := middleware.NewWrapResponseWriter(w, r.ProtoMajor)

		next.ServeHTTP(ww, r)

		duration := time.Since(start)
		log.Printf("[INFO] HTTP request method=%s path=%s statusCode=%d durationMs=%d",
			r.Method, r.URL.Path, ww.Status(), duration.Milliseconds())
	})
}
