FROM golang:1.22-alpine AS builder

WORKDIR /app

RUN apk add --no-cache git ca-certificates

COPY backend/go.mod backend/go.sum ./
RUN go mod download

COPY backend/ ./
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o /app/server ./cmd/server
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o /app/seed ./cmd/seed

FROM alpine:3.19 AS production

WORKDIR /app

RUN apk add --no-cache ca-certificates curl tzdata dumb-init

COPY --from=builder /app/server /app/server
COPY --from=builder /app/seed /app/seed

EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:4000/health || exit 1

ENTRYPOINT ["dumb-init", "--"]
CMD ["/app/server"]
