package redis

import (
	"fmt"
	"testing"

	"github.com/hibiken/asynq"
	"github.com/redis/go-redis/v9"
)

func TestParseURLSchemes(t *testing.T) {
	plainURL := "redis://default:mysecret@my-endpoint.upstash.io:6379"
	optPlain, err := redis.ParseURL(plainURL)
	if err != nil {
		t.Fatalf("plain parse failed: %v", err)
	}
	fmt.Printf("plain TLSConfig: %v\n", optPlain.TLSConfig)

	tlsURL := "rediss://default:mysecret@my-endpoint.upstash.io:6379"
	optTLS, err := redis.ParseURL(tlsURL)
	if err != nil {
		t.Fatalf("tls parse failed: %v", err)
	}
	fmt.Printf("tls TLSConfig: %+v, ServerName: %q\n", optTLS.TLSConfig, optTLS.TLSConfig.ServerName)

	asynqOpt, err := asynq.ParseRedisURI(tlsURL)
	if err != nil {
		t.Fatalf("asynq parse failed: %v", err)
	}
	fmt.Printf("asynqOpt: %#v\n", asynqOpt)
}
