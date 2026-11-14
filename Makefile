.PHONY: all build run test seed clean docker-up docker-down frontend-dev frontend-build

all: build

build:
	cd backend && go build -o bin/server ./cmd/server
	cd backend && go build -o bin/seed ./cmd/seed

run:
	cd backend && go run ./cmd/server

seed:
	cd backend && go run ./cmd/seed

test:
	cd backend && go test -v ./...

docker-up:
	docker-compose up -d

docker-down:
	docker-compose down

frontend-dev:
	npm --prefix frontend run dev

frontend-build:
	npm --prefix frontend run build

clean:
	rm -rf backend/bin
