package handlers

import (
	"fmt"
	"net/http"

	"database/sql"

	"github.com/RifqiIrawan/smart-parking/backend/models"
	"github.com/gin-gonic/gin"
)

type AuditHandler struct {
	DB *sql.DB
}

func NewAuditHandler(db *sql.DB) *AuditHandler {
	return &AuditHandler{DB: db}
}

// ListAuditLogs returns audit trail entries, newest first, with optional filters.
func (h *AuditHandler) ListAuditLogs(c *gin.Context) {
	entityType := c.Query("entity_type")
	action := c.Query("action")
	userID := c.Query("user_id")
	limit := c.DefaultQuery("limit", "50")
	offset := c.DefaultQuery("offset", "0")

	query := `
		SELECT id, user_id, COALESCE(user_name,''), COALESCE(user_email,''),
		       action, entity_type, COALESCE(entity_id,''), COALESCE(description,''),
		       COALESCE(ip_address,''), created_at
		FROM audit_logs
	`
	args := []interface{}{}
	conditions := []string{}
	argIdx := 1

	if entityType != "" {
		conditions = append(conditions, fmt.Sprintf("entity_type = $%d", argIdx))
		args = append(args, entityType)
		argIdx++
	}
	if action != "" {
		conditions = append(conditions, fmt.Sprintf("action = $%d", argIdx))
		args = append(args, action)
		argIdx++
	}
	if userID != "" {
		conditions = append(conditions, fmt.Sprintf("user_id = $%d", argIdx))
		args = append(args, userID)
		argIdx++
	}
	if len(conditions) > 0 {
		query += " WHERE " + conditions[0]
		for _, cond := range conditions[1:] {
			query += " AND " + cond
		}
	}
	query += fmt.Sprintf(" ORDER BY created_at DESC LIMIT $%d OFFSET $%d", argIdx, argIdx+1)
	args = append(args, limit, offset)

	rows, err := h.DB.Query(query, args...)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{Success: false, Message: "Gagal mengambil audit log", Error: err.Error()})
		return
	}
	defer rows.Close()

	var logs []models.AuditLog
	for rows.Next() {
		var l models.AuditLog
		rows.Scan(&l.ID, &l.UserID, &l.UserName, &l.UserEmail,
			&l.Action, &l.EntityType, &l.EntityID, &l.Description,
			&l.IPAddress, &l.CreatedAt)
		logs = append(logs, l)
	}

	var total int
	h.DB.QueryRow(`SELECT COUNT(*) FROM audit_logs`).Scan(&total)

	c.JSON(http.StatusOK, models.APIResponse{
		Success: true,
		Data: gin.H{
			"logs":  logs,
			"total": total,
		},
	})
}
