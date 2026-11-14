package websocket

import (
	"testing"
)

func TestHubSingletonAndBroadcast(t *testing.T) {
	hub1 := GetHub()
	hub2 := GetHub()

	if hub1 != hub2 {
		t.Errorf("expected GetHub() to return the same singleton instance")
	}

	// Broadcasting without connected clients should not panic or block
	hub1.Broadcast("testEvent", map[string]string{"hello": "world"})
}
