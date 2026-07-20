package handlers

import (
	"database/sql"
	"fmt"
	"net/http"
	"strings"

	"github.com/RifqiIrawan/smart-parking/backend/config"
	"github.com/RifqiIrawan/smart-parking/backend/middleware"
	"github.com/RifqiIrawan/smart-parking/backend/models"
	"github.com/gin-gonic/gin"
)

type SlotHandler struct {
	DB *sql.DB
}

func NewSlotHandler(db *sql.DB) *SlotHandler {
	return &SlotHandler{DB: db}
}

// ListFloors returns each distinct floor (with its slot count) in the
// current location scope, so the UI can show what already exists before
// the user adds a new one.
func (h *SlotHandler) ListFloors(c *gin.Context) {
	locID, isSuper := middleware.GetLocationFilter(c)

	query := `SELECT floor, zone, COUNT(*) FROM parking_slots`
	args := []interface{}{}
	if !isSuper && locID != nil {
		query += ` WHERE location_id = $1`
		args = append(args, *locID)
	}
	query += ` GROUP BY floor, zone ORDER BY floor, zone`

	rows, err := h.DB.Query(query, args...)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{Success: false, Message: err.Error()})
		return
	}
	defer rows.Close()

	type FloorInfo struct {
		Floor     string `json:"floor"`
		Zone      string `json:"zone"`
		SlotCount int    `json:"slot_count"`
	}
	var floors []FloorInfo
	for rows.Next() {
		var f FloorInfo
		rows.Scan(&f.Floor, &f.Zone, &f.SlotCount)
		floors = append(floors, f)
	}
	c.JSON(http.StatusOK, models.APIResponse{Success: true, Data: floors})
}

// resolveLocationID picks the location a new slot belongs to: an explicit
// location_id in the request body wins, otherwise fall back to the
// caller's own scoped location (operators/location-admins never need to
// pass one at all).
func resolveLocationID(c *gin.Context, requested string) (*string, error) {
	if requested != "" {
		return &requested, nil
	}
	locID, _ := middleware.GetLocationFilter(c)
	if locID != nil {
		return locID, nil
	}
	return nil, fmt.Errorf("Lokasi wajib dipilih")
}

func (h *SlotHandler) CreateSlot(c *gin.Context) {
	var req models.SlotRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, models.APIResponse{Success: false, Message: "Data tidak valid", Error: err.Error()})
		return
	}

	slotType := req.Type
	if slotType == "" {
		slotType = "regular"
	}
	status := req.Status
	if status == "" {
		status = "available"
	}

	locIDPtr, err := resolveLocationID(c, req.LocationID)
	if err != nil {
		c.JSON(http.StatusBadRequest, models.APIResponse{Success: false, Message: err.Error()})
		return
	}

	slotNumber := strings.ToUpper(strings.TrimSpace(req.SlotNumber))

	var s models.ParkingSlot
	err = h.DB.QueryRow(`
		INSERT INTO parking_slots (slot_number, floor, zone, type, status, location_id)
		VALUES ($1,$2,$3,$4,$5,$6)
		RETURNING id, slot_number, floor, zone, type, status, location_id, created_at, updated_at
	`, slotNumber, req.Floor, req.Zone, slotType, status, locIDPtr).Scan(
		&s.ID, &s.SlotNumber, &s.Floor, &s.Zone, &s.Type, &s.Status, &s.LocationID, &s.CreatedAt, &s.UpdatedAt,
	)
	if err != nil {
		if strings.Contains(err.Error(), "duplicate key") {
			c.JSON(http.StatusConflict, models.APIResponse{Success: false, Message: fmt.Sprintf("Slot %s sudah ada", slotNumber)})
			return
		}
		c.JSON(http.StatusInternalServerError, models.APIResponse{Success: false, Message: "Gagal membuat slot", Error: err.Error()})
		return
	}

	config.LogAudit(h.DB, c, "CREATE", "slot", s.ID, fmt.Sprintf("Slot %s (lantai %s, zona %s) dibuat", s.SlotNumber, s.Floor, s.Zone))
	c.JSON(http.StatusCreated, models.APIResponse{Success: true, Message: "Slot berhasil dibuat", Data: s})
}

// CreateSlotsBulk adds a whole floor's worth of slots at once, numbered
// sequentially within the given prefix — e.g. zone "C" + count 15 -> C01..C15.
// Re-running it for the same prefix/location continues the numbering
// instead of colliding with slots that already exist.
func (h *SlotHandler) CreateSlotsBulk(c *gin.Context) {
	var req models.BulkSlotRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, models.APIResponse{Success: false, Message: "Data tidak valid", Error: err.Error()})
		return
	}

	slotType := req.Type
	if slotType == "" {
		slotType = "regular"
	}
	prefix := strings.ToUpper(strings.TrimSpace(req.Prefix))
	if prefix == "" {
		prefix = strings.ToUpper(strings.TrimSpace(req.Zone))
	}

	locIDPtr, err := resolveLocationID(c, req.LocationID)
	if err != nil {
		c.JSON(http.StatusBadRequest, models.APIResponse{Success: false, Message: err.Error()})
		return
	}

	var maxNum sql.NullInt64
	h.DB.QueryRow(`
		SELECT MAX(CAST(regexp_replace(slot_number, '^' || $1, '') AS INT))
		FROM parking_slots
		WHERE slot_number ~ ('^' || $1 || '[0-9]+$') AND location_id = $2
	`, prefix, *locIDPtr).Scan(&maxNum)

	start := 1
	if maxNum.Valid {
		start = int(maxNum.Int64) + 1
	}

	tx, err := h.DB.Begin()
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{Success: false, Message: "Database error"})
		return
	}
	defer tx.Rollback()

	created := 0
	for i := start; i < start+req.Count; i++ {
		slotNumber := fmt.Sprintf("%s%02d", prefix, i)
		if _, err := tx.Exec(`
			INSERT INTO parking_slots (slot_number, floor, zone, type, status, location_id)
			VALUES ($1,$2,$3,$4,'available',$5)
			ON CONFLICT DO NOTHING
		`, slotNumber, req.Floor, req.Zone, slotType, *locIDPtr); err != nil {
			c.JSON(http.StatusInternalServerError, models.APIResponse{Success: false, Message: "Gagal membuat slot", Error: err.Error()})
			return
		}
		created++
	}

	if err := tx.Commit(); err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{Success: false, Message: "Gagal menyimpan perubahan"})
		return
	}

	config.LogAudit(h.DB, c, "CREATE", "slot", "",
		fmt.Sprintf("Lantai %s (zona %s) ditambahkan: %d slot (%s%02d–%s%02d)", req.Floor, req.Zone, created, prefix, start, prefix, start+created-1))

	c.JSON(http.StatusCreated, models.APIResponse{
		Success: true,
		Message: fmt.Sprintf("%d slot berhasil ditambahkan untuk lantai %s", created, req.Floor),
		Data: gin.H{
			"created": created, "floor": req.Floor, "zone": req.Zone,
			"from": fmt.Sprintf("%s%02d", prefix, start), "to": fmt.Sprintf("%s%02d", prefix, start+created-1),
		},
	})
}

func (h *SlotHandler) UpdateSlot(c *gin.Context) {
	id := c.Param("id")
	var req models.SlotRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, models.APIResponse{Success: false, Message: "Data tidak valid", Error: err.Error()})
		return
	}

	slotType := req.Type
	if slotType == "" {
		slotType = "regular"
	}
	status := req.Status
	if status == "" {
		status = "available"
	}

	result, err := h.DB.Exec(`
		UPDATE parking_slots SET floor=$1, zone=$2, type=$3, status=$4, updated_at=NOW()
		WHERE id=$5
	`, req.Floor, req.Zone, slotType, status, id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{Success: false, Message: "Gagal memperbarui slot", Error: err.Error()})
		return
	}
	rows, _ := result.RowsAffected()
	if rows == 0 {
		c.JSON(http.StatusNotFound, models.APIResponse{Success: false, Message: "Slot tidak ditemukan"})
		return
	}

	config.LogAudit(h.DB, c, "UPDATE", "slot", id, fmt.Sprintf("Slot diperbarui: lantai %s, zona %s, status %s", req.Floor, req.Zone, status))
	c.JSON(http.StatusOK, models.APIResponse{Success: true, Message: "Slot berhasil diperbarui"})
}

func (h *SlotHandler) DeleteSlot(c *gin.Context) {
	id := c.Param("id")

	var status string
	err := h.DB.QueryRow(`SELECT status FROM parking_slots WHERE id = $1`, id).Scan(&status)
	if err == sql.ErrNoRows {
		c.JSON(http.StatusNotFound, models.APIResponse{Success: false, Message: "Slot tidak ditemukan"})
		return
	}
	if status == "occupied" {
		c.JSON(http.StatusConflict, models.APIResponse{Success: false, Message: "Slot sedang terisi kendaraan, tidak bisa dihapus"})
		return
	}

	_, err = h.DB.Exec(`DELETE FROM parking_slots WHERE id = $1`, id)
	if err != nil {
		if strings.Contains(err.Error(), "foreign key") || strings.Contains(err.Error(), "violates") {
			c.JSON(http.StatusConflict, models.APIResponse{Success: false, Message: "Slot punya riwayat transaksi, tidak bisa dihapus. Ubah status ke maintenance sebagai gantinya."})
			return
		}
		c.JSON(http.StatusInternalServerError, models.APIResponse{Success: false, Message: "Gagal menghapus slot", Error: err.Error()})
		return
	}

	config.LogAudit(h.DB, c, "DELETE", "slot", id, "Slot dihapus")
	c.JSON(http.StatusOK, models.APIResponse{Success: true, Message: "Slot berhasil dihapus"})
}
