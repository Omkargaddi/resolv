package queue

import (
	"context"
	"encoding/json"
	"log"
	"time"

	"github.com/hibiken/asynq"
	"resolv-backend/internal/config"
)

const (
	TypeBookingConfirmed   = "booking:confirmed"
	TypeBookingCancelled   = "booking:cancelled"
	TypeReclaimExpiredSlot = "slot:reclaim-expired-holds"
	QueueName              = "reserve-jobs"
)

type QueueStats struct {
	Waiting   int `json:"waiting"`
	Active    int `json:"active"`
	Completed int `json:"completed"`
	Failed    int `json:"failed"`
	Delayed   int `json:"delayed"`
	Paused    int `json:"paused"`
}

type Service struct {
	client    *asynq.Client
	server    *asynq.Server
	scheduler *asynq.Scheduler
	inspector *asynq.Inspector
	redisOpt  asynq.RedisConnOpt
}

func NewService(cfg *config.Config) (*Service, error) {
	redisOpt, err := asynq.ParseRedisURI(cfg.RedisURL)
	if err != nil {
		return nil, err
	}

	client := asynq.NewClient(redisOpt)
	inspector := asynq.NewInspector(redisOpt)

	srv := asynq.NewServer(
		redisOpt,
		asynq.Config{
			Concurrency: cfg.WorkerConcurrency,
			Queues: map[string]int{
				QueueName: 1,
			},
			LogLevel: asynq.InfoLevel,
		},
	)

	scheduler := asynq.NewScheduler(redisOpt, &asynq.SchedulerOpts{
		Location: time.UTC,
	})

	return &Service{
		client:    client,
		server:    srv,
		scheduler: scheduler,
		inspector: inspector,
		redisOpt:  redisOpt,
	}, nil
}

func (s *Service) StartWorkers() error {
	mux := asynq.NewServeMux()

	mux.HandleFunc(TypeBookingConfirmed, func(ctx context.Context, t *asynq.Task) error {
		log.Printf("[INFO] Processing job %s: payload=%s", t.Type(), string(t.Payload()))
		return nil
	})

	mux.HandleFunc(TypeBookingCancelled, func(ctx context.Context, t *asynq.Task) error {
		log.Printf("[INFO] Processing job %s: payload=%s", t.Type(), string(t.Payload()))
		return nil
	})

	mux.HandleFunc(TypeReclaimExpiredSlot, func(ctx context.Context, t *asynq.Task) error {
		log.Printf("[INFO] Processing job %s", t.Type())
		return nil
	})

	// schedule recurring job every 5 minutes: */5 * * * *
	reclaimTask := asynq.NewTask(TypeReclaimExpiredSlot, nil, asynq.Queue(QueueName))
	if _, err := s.scheduler.Register("*/5 * * * *", reclaimTask); err != nil {
		log.Printf("[WARN] Failed to register recurring reclaim task: %v", err)
	}

	if err := s.scheduler.Start(); err != nil {
		log.Printf("[WARN] Failed to start task scheduler: %v", err)
	}

	go func() {
		if err := s.server.Run(mux); err != nil {
			log.Printf("[ERROR] Asynq server error: %v", err)
		}
	}()

	log.Println("[INFO] Queue workers and recurring scheduler started")
	return nil
}

func (s *Service) Enqueue(taskType string, payload interface{}) error {
	data, err := json.Marshal(payload)
	if err != nil {
		return err
	}

	task := asynq.NewTask(taskType, data, asynq.Queue(QueueName), asynq.MaxRetry(3))
	info, err := s.client.Enqueue(task)
	if err != nil {
		return err
	}
	log.Printf("[INFO] Job enqueued: type=%s, id=%s", taskType, info.ID)
	return nil
}

func (s *Service) GetQueueStats() (*QueueStats, error) {
	qInfo, err := s.inspector.GetQueueInfo(QueueName)
	if err != nil {
		// if queue doesn't exist yet, return zeros
		return &QueueStats{
			Waiting:   0,
			Active:    0,
			Completed: 0,
			Failed:    0,
			Delayed:   0,
			Paused:    0,
		}, nil
	}

	paused := 0
	if qInfo.Paused {
		paused = 1
	}

	return &QueueStats{
		Waiting:   qInfo.Pending,
		Active:    qInfo.Active,
		Completed: qInfo.Completed,
		Failed:    qInfo.Archived,
		Delayed:   qInfo.Scheduled + qInfo.Retry,
		Paused:    paused,
	}, nil
}

func (s *Service) Shutdown() {
	if s.scheduler != nil {
		s.scheduler.Shutdown()
	}
	if s.server != nil {
		s.server.Shutdown()
	}
	if s.client != nil {
		_ = s.client.Close()
	}
	if s.inspector != nil {
		_ = s.inspector.Close()
	}
	log.Println("[INFO] Queue service shut down")
}
