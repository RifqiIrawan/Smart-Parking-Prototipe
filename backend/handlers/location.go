package handlers

import (
	"database/sql"
	"fmt"
	"net/http"

	"github.com/RifqiIrawan/smart-parking/backend/middleware"
	"github.com/RifqiIrawan/smart-parking/backend/models"
	"github.com/gin-gonic/gin"
)

type LocationHandler struct {
	DB *sql.DB
}

func NewLocationHandler(db *sql.DB) *LocationHandler {
	return &LocationHandler{DB: db}
}

// ListLocations — super_admin sees all; others see only their own location
func (h *LocationHandler) ListLocations(c *gin.Context) {
	locID, isSuper := middleware.GetLocationFilter(c)

	var rows *sql.Rows
	var err error

	if isSuper {
		rows, err = h.DB.Query(`
			SELECT l.id, l.name, l.code, l.address, l.city, l.phone, l.email,
			       l.capacity, l.is_active, l.created_at, l.updated_at,
			       COUNT(s.id) FILTER (WHERE s.status='available') AS active_slots,
			       COUNT(s.id) FILTER (WHERE s.status='occupied')  AS occupied_slots
			FROM locations l
			LEFT JOIN parking_slots s ON s.location_id = l.id
			GROUP BY l.id
			ORDER BY l.name
		`)
	} else {
		rows, err = h.DB.Query(`
			SELECT l.id, l.name, l.code, l.address, l.city, l.phone, l.email,
			       l.capacity, l.is_active, l.created_at, l.updated_at,
			       COUNT(s.id) FILTER (WHERE s.status='available') AS active_slots,
			       COUNT(s.id) FILTER (WHERE s.status='occupied')  AS occupied_slots
			FROM locations l
			LEFT JOIN parking_slots s ON s.location_id = l.id
			WHERE l.id = $1
			GROUP BY l.id
		`, locID)
	}

	if err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{Success: false, Message: "Query failed", Error: err.Error()})
		return
	}
	defer rows.Close()

	var locations []models.Location
	for rows.Next() {
		var loc models.Location
		rows.Scan(
			&loc.ID, &loc.Name, &loc.Code, &loc.Address, &loc.City,
			&loc.Phone, &loc.Email, &loc.Capacity, &loc.IsActive,
			&loc.CreatedAt, &loc.UpdatedAt,
			&loc.ActiveSlots, &loc.OccupiedSlots,
		)
		locations = append(locations, loc)
	}

	c.JSON(http.StatusOK, models.APIResponse{Success: true, Data: locations})
}

func (h *LocationHandler) GetLocation(c *gin.Context) {
	id := c.Param("id")
	locID, isSuper := middleware.GetLocationFilter(c)

	if !isSuper && (locID == nil || *locID != id) {
		c.JSON(http.StatusForbidden, models.APIResponse{Success: false, Message: "Akses ke lokasi ini ditolak"})
		return
	}

	var loc models.Location
	err := h.DB.QueryRow(`
		SELECT id, name, code, address, city, phone, email,
		       capacity, is_active, created_at, updated_at
		FROM locations WHERE id = $1
	`, id).Scan(
		&loc.ID, &loc.Name, &loc.Code, &loc.Address, &loc.City,
		&loc.Phone, &loc.Email, &loc.Capacity, &loc.IsActive,
		&loc.CreatedAt, &loc.UpdatedAt,
	)
	if err == sql.ErrNoRows {
		c.JSON(http.StatusNotFound, models.APIResponse{Success: false, Message: "Lokasi tidak ditemukan"})
		return
	}
	c.JSON(http.StatusOK, models.APIResponse{Success: true, Data: loc})
}

func (h *LocationHandler) CreateLocation(c *gin.Context) {
	var req models.LocationRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, models.APIResponse{Success: false, Message: err.Error()})
		return
	}

	var loc models.Location
	err := h.DB.QueryRow(`
		INSERT INTO locations (name, code, address, city, phone, email, capacity, is_active)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
		RETURNING id, name, code, created_at, updated_at
	`, req.Name, req.Code, req.Address, req.City, req.Phone, req.Email, req.Capacity, req.IsActive,
	).Scan(&loc.ID, &loc.Name, &loc.Code, &loc.CreatedAt, &loc.UpdatedAt)

	if err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{Success: false, Message: "Gagal membuat lokasi", Error: err.Error()})
		return
	}
	c.JSON(http.StatusCreated, models.APIResponse{Success: true, Message: "Lokasi berhasil dibuat", Data: loc})
}

func (h *LocationHandler) UpdateLocation(c *gin.Context) {
	id := c.Param("id")
	var req models.LocationRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, models.APIResponse{Success: false, Message: err.Error()})
		return
	}

	_, err := h.DB.Exec(`
		UPDATE locations
		SET name=$1, code=$2, address=$3, city=$4, phone=$5, email=$6,
		    capacity=$7, is_active=$8, updated_at=NOW()
		WHERE id=$9
	`, req.Name, req.Code, req.Address, req.City, req.Phone, req.Email,
		req.Capacity, req.IsActive, id)

	if err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{Success: false, Message: "Gagal update lokasi", Error: err.Error()})
		return
	}
	c.JSON(http.StatusOK, models.APIResponse{Success: true, Message: fmt.Sprintf("Lokasi %s berhasil diupdate", id)})
}

func (h *LocationHandler) DeleteLocation(c *gin.Context) {
	id := c.Param("id")

	// Check if location has active data
	var count int
	h.DB.QueryRow(`SELECT COUNT(*) FROM users WHERE location_id=$1`, id).Scan(&count)
	if count > 0 {
		c.JSON(http.StatusConflict, models.APIResponse{
			Success: false,
			Message: fmt.Sprintf("Lokasi tidak bisa dihapus, masih ada %d user terdaftar", count),
		})
		return
	}

	h.DB.Exec(`UPDATE locations SET is_active=false, updated_at=NOW() WHERE id=$1`, id)
	c.JSON(http.StatusOK, models.APIResponse{Success: true, Message: "Lokasi dinonaktifkan"})
}

// GetLocationStats — dashboard stats per location (for super_admin overview)
func (h *LocationHandler) GetLocationStats(c *gin.Context) {
	rows, err := h.DB.Query(`
		SELECT
			l.id, l.name, l.code, l.city,
			COUNT(DISTINCT s.id) FILTER (WHERE s.status='available') AS available,
			COUNT(DISTINCT s.id) FILTER (WHERE s.status='occupied')  AS occupied,
			COUNT(DISTINCT s.id) AS total_slots,
			COUNT(DISTINCT t.id) FILTER (WHERE t.status='active')    AS active_tx,
			COALESCE(SUM(p.amount) FILTER (WHERE p.paid_at::date = CURRENT_DATE), 0) AS today_revenue
		FROM locations l
		LEFT JOIN parking_slots s ON s.location_id = l.id
		LEFT JOIN parking_transactions t ON t.location_id = l.id
		LEFT JOIN payments p ON p.transaction_id = t.id AND p.status='paid'
		WHERE l.is_active = true
		GROUP BY l.id
		ORDER BY l.name
	`)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{Success: false, Message: err.Error()})
		return
	}
	defer rows.Close()

	type LocationStat struct {
		ID           string  `json:"id"`
		Name         string  `json:"name"`
		Code         string  `json:"code"`
		City         string  `json:"city"`
		Available    int     `json:"available_slots"`
		Occupied     int     `json:"occupied_slots"`
		TotalSlots   int     `json:"total_slots"`
		ActiveTx     int     `json:"active_transactions"`
		TodayRevenue float64 `json:"today_revenue"`
		OccupancyPct float64 `json:"occupancy_pct"`
	}

	var stats []LocationStat
	for rows.Next() {
		var s LocationStat
		rows.Scan(&s.ID, &s.Name, &s.Code, &s.City,
			&s.Available, &s.Occupied, &s.TotalSlots, &s.ActiveTx, &s.TodayRevenue)
		if s.TotalSlots > 0 {
			s.OccupancyPct = float64(s.Occupied) / float64(s.TotalSlots) * 100
		}
		stats = append(stats, s)
	}

	c.JSON(http.StatusOK, models.APIResponse{Success: true, Data: stats})
}
