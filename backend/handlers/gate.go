package handlers

import (
	"database/sql"
	"fmt"
	"net/http"

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
	rows, err := h.DB.Query(`
		SELECT id, name, type, location, status, ip_address, is_active, created_at, updated_at
		FROM gates ORDER BY name
	`)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{Success: false, Message: "Failed"})
		return
	}
	defer rows.Close()

	var gates []models.Gate
	for rows.Next() {
		var g models.Gate
		rows.Scan(&g.ID, &g.Name, &g.Type, &g.Location, &g.Status, &g.IPAddress, &g.IsActive, &g.CreatedAt, &g.UpdatedAt)
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

	err := h.DB.QueryRow(`
		INSERT INTO gates (name, type, location, ip_address)
		VALUES ($1, $2, $3, $4) RETURNING id, created_at, updated_at
	`, g.Name, g.Type, g.Location, g.IPAddress).Scan(&g.ID, &g.CreatedAt, &g.UpdatedAt)

	if err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{Success: false, Message: err.Error()})
		return
	}
	g.Status = "closed"
	g.IsActive = true
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

	// TODO: Send HTTP/MQTT command to physical gate controller
	// go sendGateCommand(req.GateID, req.Command)

	c.JSON(http.StatusOK, models.APIResponse{
		Success: true,
		Message: fmt.Sprintf("Gate %s successfully", req.Command),
		Data:    gin.H{"gate_id": req.GateID, "status": status},
	})
}
