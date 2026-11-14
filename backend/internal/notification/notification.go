package notification

import (
	"context"
	"fmt"
	"log"
)

type NotificationType string

const (
	TypeBookingConfirmed NotificationType = "booking_confirmed"
	TypeBookingCancelled NotificationType = "booking_cancelled"
	TypeBookingReminder  NotificationType = "booking_reminder"
	TypeSlotAvailable    NotificationType = "slot_available"
	TypeWaitlistPromoted NotificationType = "waitlist_promoted"
)

type NotificationPayload struct {
	Type     NotificationType       `json:"type"`
	UserID   string                 `json:"userId"`
	Data     map[string]interface{} `json:"data"`
	Channels []string               `json:"channels,omitempty"`
}

type NotificationTemplate struct {
	Title string
	Body  string
}

func getTemplate(nType NotificationType, data map[string]interface{}) NotificationTemplate {
	code, _ := data["confirmationCode"].(string)
	date, _ := data["date"].(string)
	startTime, _ := data["startTime"].(string)

	switch nType {
	case TypeBookingConfirmed:
		return NotificationTemplate{
			Title: "Booking Confirmed",
			Body:  fmt.Sprintf("Your reservation (%s) has been confirmed for %s.", code, date),
		}
	case TypeBookingCancelled:
		return NotificationTemplate{
			Title: "Booking Cancelled",
			Body:  fmt.Sprintf("Your reservation (%s) has been cancelled.", code),
		}
	case TypeBookingReminder:
		return NotificationTemplate{
			Title: "Upcoming Reservation",
			Body:  fmt.Sprintf("Reminder: your reservation (%s) is scheduled for %s.", code, startTime),
		}
	case TypeSlotAvailable:
		return NotificationTemplate{
			Title: "Slot Now Available",
			Body:  fmt.Sprintf("A slot you were watching on %s is now available. Book it before it fills up!", date),
		}
	case TypeWaitlistPromoted:
		return NotificationTemplate{
			Title: "You Got a Spot!",
			Body:  fmt.Sprintf("Great news! Your waitlisted reservation (%s) has been confirmed.", code),
		}
	default:
		return NotificationTemplate{
			Title: "Notification",
			Body:  fmt.Sprintf("Reservation update: %s", code),
		}
	}
}

type Service struct{}

func NewService() *Service {
	return &Service{}
}

func (s *Service) Send(ctx context.Context, payload NotificationPayload) {
	tmpl := getTemplate(payload.Type, payload.Data)
	log.Printf("[INFO] [Notification] [%s] user=%s: %s - %s", payload.Type, payload.UserID, tmpl.Title, tmpl.Body)
}
