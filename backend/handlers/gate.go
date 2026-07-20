package handlers

import (
	"database/sql"
	"fmt"
	"net/http"

	"github.com/RifqiIrawan/smart-parking/backend/config"
	"github.com/RifqiIrawan/smart-parking/backend/middleware"
	"github.com/RifqiIrawan/smart-parking/backend/models"
	"github.com/gin-gonic/gin"
)

type GateHandler struct {
	DB *sql.DB
}

func NewGateHandler(db *sql.DB) *GateHandler {
	return &GateHandler{DB: db}
}

func (h *GateHandler) ListGates(c *gin.Context) {
	locID, isSuper := middleware.GetLocationFilter(c)

	query := `SELECT g.id, g.name, g.type, g.location, g.status, g.ip_address,
	                 g.location_id, COALESCE(l.name,'') AS location_name,
	                 g.is_active, g.created_at, g.updated_at
	          FROM gates g
	          LEFT JOIN locations l ON l.id = g.location_id`
	var args []interface{}
	if !isSuper && locID != nil {
		query += " WHERE g.location_id = $1"
		args = append(args, *locID)
	}
	query += " ORDER BY g.name"

	rows, err := h.DB.Query(query, args...)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{Success: false, Message: "Failed"})
		return
	}
	defer rows.Close()

	var gates []models.Gate
	for rows.Next() {
		var g models.Gate
		rows.Scan(&g.ID, &g.Name, &g.Type, &g.Location, &g.Status, &g.IPAddress,
			&g.LocationID, &g.LocationName, &g.IsActive, &g.CreatedAt, &g.UpdatedAt)
		gates = append(gates, g)
	}
	c.JSON(http.StatusOK, models.APIResponse{Success: true, Data: gates})
}

func (h *GateHandler) GetGate(c *gin.Context) {
	id := c.Param("id")
	var g models.Gate
	err := h.DB.QueryRow(`
		SELECT id, name, type, location, status, ip_address, is_active, created_at, updated_at
		FROM gates WHERE id = $1
	`, id).Scan(&g.ID, &g.Name, &g.Type, &g.Location, &g.Status, &g.IPAddress, &g.IsActive, &g.CreatedAt, &g.UpdatedAt)

	if err == sql.ErrNoRows {
		c.JSON(http.StatusNotFound, models.APIResponse{Success: false, Message: "Gate not found"})
		return
	}
	c.JSON(http.StatusOK, models.APIResponse{Success: true, Data: g})
}

func (h *GateHandler) CreateGate(c *gin.Context) {
	var g models.Gate
	if err := c.ShouldBindJSON(&g); err != nil {
		c.JSON(http.StatusBadRequest, models.APIResponse{Success: false, Message: err.Error()})
		return
	}

	locID, _ := middleware.GetLocationFilter(c)
	var locIDPtr *string
	if locID != nil { locIDPtr = locID }

	err := h.DB.QueryRow(`
		INSERT INTO gates (name, type, location, ip_address, location_id)
		VALUES ($1, $2, $3, $4, $5) RETURNING id, created_at, updated_at
	`, g.Name, g.Type, g.Location, g.IPAddress, locIDPtr).Scan(&g.ID, &g.CreatedAt, &g.UpdatedAt)

	if err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{Success: false, Message: err.Error()})
		return
	}
	g.Status = "closed"
	g.IsActive = true
	config.LogAudit(h.DB, c, "CREATE", "gate", g.ID, fmt.Sprintf("Gate %s dibuat", g.Name))
	c.JSON(http.StatusCreated, models.APIResponse{Success: true, Message: "Gate created", Data: g})
}

func (h *GateHandler) UpdateGate(c *gin.Context) {
	id := c.Param("id")
	var g models.Gate
	if err := c.ShouldBindJSON(&g); err != nil {
		c.JSON(http.StatusBadRequest, models.APIResponse{Success: false, Message: err.Error()})
		return
	}

	_, err := h.DB.Exec(`
		UPDATE gates SET name=$1, type=$2, location=$3, ip_address=$4, is_active=$5, updated_at=NOW()
		WHERE id=$6
	`, g.Name, g.Type, g.Location, g.IPAddress, g.IsActive, id)

	if err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{Success: false, Message: err.Error()})
		return
	}
	config.LogAudit(h.DB, c, "UPDATE", "gate", id, fmt.Sprintf("Gate %s diperbarui", g.Name))
	c.JSON(http.StatusOK, models.APIResponse{Success: true, Message: "Gate updated"})
}

func (h *GateHandler) ControlGate(c *gin.Context) {
	var req models.GateControlRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, models.APIResponse{Success: false, Message: err.Error()})
		return
	}

	status := "closed"
	if req.Command == "open" {
		status = "open"
	}

	// Get gate name for MQTT message
	var gateName string
	h.DB.QueryRow(`SELECT name FROM gates WHERE id = $1`, req.GateID).Scan(&gateName)

	result, err := h.DB.Exec(`UPDATE gates SET status=$1, updated_at=NOW() WHERE id=$2`, status, req.GateID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{Success: false, Message: err.Error()})
		return
	}

	rows, _ := result.RowsAffected()
	if rows == 0 {
		c.JSON(http.StatusNotFound, models.APIResponse{Success: false, Message: "Gate not found"})
		return
	}

	// Publish MQTT command to ESP32/hardware
	go config.PublishGateCommand(req.GateID, gateName, req.Command)

	config.LogAudit(h.DB, c, "UPDATE", "gate", req.GateID, fmt.Sprintf("Gate %s di-%s manual", gateName, req.Command))

	c.JSON(http.StatusOK, models.APIResponse{
		Success: true,
		Message: fmt.Sprintf("Gate %s successfully", req.Command),
		Data: gin.H{
			"gate_id":   req.GateID,
			"gate_name": gateName,
			"status":    status,
			"mqtt":      fmt.Sprintf("smart-parking/gate/%s/command", req.GateID),
		},
	})
}
