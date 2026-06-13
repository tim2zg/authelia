package model

import "time"

// ActiveSession represents a user's active session.
type ActiveSession struct {
	ID           string    `db:"id" json:"id"`
	Username     string    `db:"username" json:"username"`
	IPAddress    string    `db:"ip_address" json:"ip_address"`
	UserAgent    string    `db:"user_agent" json:"user_agent"`
	CreatedAt    time.Time `db:"created_at" json:"created_at"`
	LastActivity time.Time `db:"last_activity" json:"last_activity"`
}
