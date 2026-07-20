package config

import (
	"database/sql"
	"log"

	"github.com/gin-gonic/gin"
)

// LogAudit records a user action for the audit trail. It runs in the
// background so a slow/failed audit insert never blocks the API response.
func LogAudit(db *sql.DB, c *gin.Context, action, entityType, entityID, description string) {
	userID, _ := c.Get("user_id")
	email, _ := c.Get("email")

	userIDStr, _ := userID.(string)
	emailStr, _ := email.(string)
	ip := c.ClientIP()

	go func() {
		var userName string
		if userIDStr != "" {
			db.QueryRow(`SELECT name FROM users WHERE id = $1`, userIDStr).Scan(&userName)
		}
		_, err := db.Exec(`
			INSERT INTO audit_logs (user_id, user_name, user_email, action, entity_type, entity_id, description, ip_address)
			VALUES (NULLIF($1,'')::uuid, $2, $3, $4, $5, $6, $7, $8)
		`, userIDStr, userName, emailStr, action, entityType, entityID, description, ip)
		if err != nil {
			log.Printf("[AUDIT] Failed to log action %s on %s: %v", action, entityType, err)
		}
	}()
}
