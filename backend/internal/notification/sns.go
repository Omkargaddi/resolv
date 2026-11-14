package notification

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	awsconfig "github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/service/sns"
	"resolv-backend/internal/config"
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

type Service struct {
	client   *sns.Client
	topicARN string
}

func NewService(ctx context.Context, cfg *config.Config) *Service {
	if cfg.SNSTopicARN == "" {
		return &Service{client: nil, topicARN: ""}
	}

	var optFns []func(*awsconfig.LoadOptions) error
	optFns = append(optFns, awsconfig.WithRegion(cfg.AWSRegion))

	if cfg.AWSAccessKeyID != "" && cfg.AWSSecretAccessKey != "" {
		optFns = append(optFns, awsconfig.WithCredentialsProvider(
			credentials.NewStaticCredentialsProvider(cfg.AWSAccessKeyID, cfg.AWSSecretAccessKey, ""),
		))
	}

	awsCfg, err := awsconfig.LoadDefaultConfig(ctx, optFns...)
	if err != nil {
		log.Printf("[WARN] Failed to load AWS config for SNS: %v", err)
		return &Service{client: nil, topicARN: ""}
	}

	var clientOpts []func(*sns.Options)
	if cfg.SNSEndpoint != "" {
		clientOpts = append(clientOpts, func(o *sns.Options) {
			o.BaseEndpoint = aws.String(cfg.SNSEndpoint)
		})
	}

	client := sns.NewFromConfig(awsCfg, clientOpts...)
	return &Service{
		client:   client,
		topicARN: cfg.SNSTopicARN,
	}
}

func (s *Service) Send(ctx context.Context, payload NotificationPayload) {
	if s.client == nil || s.topicARN == "" {
		log.Printf("[DEBUG] SNS not configured, skipping notification for user %s (%s)", payload.UserID, payload.Type)
		return
	}

	tmpl := getTemplate(payload.Type, payload.Data)
	bodyData := map[string]interface{}{
		"type":   payload.Type,
		"userId": payload.UserID,
		"title":  tmpl.Title,
		"body":   tmpl.Body,
		"data":   payload.Data,
		"sentAt": time.Now().UTC().Format(time.RFC3339Nano),
	}
	encodedBody, _ := json.Marshal(bodyData)

	messageMap := map[string]string{
		"default":      tmpl.Body,
		"notification": string(encodedBody),
	}
	messageJSON, _ := json.Marshal(messageMap)

	input := &sns.PublishInput{
		TopicArn:         aws.String(s.topicARN),
		Message:          aws.String(string(messageJSON)),
		MessageStructure: aws.String("json"),
	}

	_, err := s.client.Publish(ctx, input)
	if err != nil {
		log.Printf("[ERROR] Failed to send SNS notification: %v", err)
		return
	}
	log.Printf("[INFO] SNS notification sent for user %s: %s", payload.UserID, tmpl.Title)
}
