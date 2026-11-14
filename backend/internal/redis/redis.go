package redis

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"log"
	"time"

	"github.com/redis/go-redis/v9"
	"resolv-backend/internal/config"
)

type Client struct {
	RDB *redis.Client
}

func NewClient(cfg *config.Config) (*Client, error) {
	opts, err := redis.ParseURL(cfg.RedisURL)
	if err != nil {
		return nil, fmt.Errorf("invalid redis url: %w", err)
	}

	opts.MaxRetries = 3
	rdb := redis.NewClient(opts)

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := rdb.Ping(ctx).Err(); err != nil {
		return nil, fmt.Errorf("redis connection error: %w", err)
	}

	log.Println("[INFO] Redis connection established")
	return &Client{RDB: rdb}, nil
}

func (c *Client) Close() error {
	if c.RDB != nil {
		return c.RDB.Close()
	}
	return nil
}

// acquires a distributed lock using SET NX PX
func (c *Client) AcquireLock(ctx context.Context, key string, ttl time.Duration) (string, error) {
	b := make([]byte, 16)
	_, _ = rand.Read(b)
	lockID := fmt.Sprintf("lock:%d:%s", time.Now().UnixNano(), hex.EncodeToString(b))

	fullKey := "lock:" + key
	ok, err := c.RDB.SetNX(ctx, fullKey, lockID, ttl).Result()
	if err != nil {
		return "", err
	}
	if !ok {
		return "", nil // not acquired
	}
	return lockID, nil
}

// releases the distributed lock via an atomic Lua script
func (c *Client) ReleaseLock(ctx context.Context, key, lockID string) (bool, error) {
	script := `
		if redis.call("get", KEYS[1]) == ARGV[1] then
			return redis.call("del", KEYS[1])
		else
			return 0
		end
	`
	fullKey := "lock:" + key
	res, err := c.RDB.Eval(ctx, script, []string{fullKey}, lockID).Result()
	if err != nil {
		return false, err
	}
	if val, ok := res.(int64); ok && val == 1 {
		return true, nil
	}
	return false, nil
}

// retrieves cached slots JSON
func (c *Client) GetSlotCache(ctx context.Context, venueID, date string) (string, error) {
	cacheKey := fmt.Sprintf("slots:%s:%s", venueID, date)
	return c.RDB.Get(ctx, cacheKey).Result()
}

// saves slots JSON to cache with 60s TTL
func (c *Client) SetSlotCache(ctx context.Context, venueID, date string, data string) error {
	cacheKey := fmt.Sprintf("slots:%s:%s", venueID, date)
	return c.RDB.Set(ctx, cacheKey, data, 60*time.Second).Err()
}

// deletes the cached slots for a venue and date
func (c *Client) InvalidateSlotCache(ctx context.Context, venueID, date string) error {
	cacheKey := fmt.Sprintf("slots:%s:%s", venueID, date)
	return c.RDB.Del(ctx, cacheKey).Err()
}
