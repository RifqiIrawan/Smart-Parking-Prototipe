package handlers

import (
	"database/sql"
	"fmt"
	"math"
	"net/http"
	"strings"
	"time"

	"github.com/RifqiIrawan/smart-parking/backend/config"
	"github.com/RifqiIrawan/smart-parking/backend/middleware"
	"github.com/RifqiIrawan/smart-parking/backend/models"
	"github.com/gin-gonic/gin"
)

type VehicleHandler struct {
	DB *sql.DB
}

func NewVehicleHandler(db *sql.DB) *VehicleHandler {
	return &VehicleHandler{DB: db}
}

func generateTicketNumber() string {
	now := time.Now()
	return fmt.Sprintf("TKT-%s-%04d", now.Format("20060102150405"), now.Nanosecond()%10000)
}

func (h *VehicleHandler) Entry(c *gin.Context) {
	var req models.VehicleEntryRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, models.APIResponse{
			Success: false, Message: "Data tidak valid", Error: err.Error(),
		})
		return
	}

	// Check duplicate active transaction
	var existingID string
	err := h.DB.QueryRow(`
		SELECT id FROM parking_transactions
		WHERE plate_number = $1 AND status = 'active' LIMIT 1
	`, req.PlateNumber).Scan(&existingID)
	if err == nil {
		c.JSON(http.StatusConflict, models.APIResponse{
			Success: false,
			Message: fmt.Sprintf("Kendaraan %s sudah ada di dalam parkir", req.PlateNumber),
		})
		return
	}

	vehicleType := req.VehicleType
	if vehicleType == "" {
		vehicleType = "car"
	}

	// Upsert vehicle
	var vehicleID string
	err = h.DB.QueryRow(`
		INSERT INTO vehicles (plate_number, type)
		VALUES ($1, $2)
		ON CONFLICT (plate_number) DO UPDATE SET updated_at = NOW()
		RETURNING id
	`, req.PlateNumber, vehicleType).Scan(&vehicleID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{
			Success: false, Message: "Gagal mendaftarkan kendaraan", Error: err.Error(),
		})
		return
	}

	// Get tariff
	var baseRate float64
	h.DB.QueryRow(`
		SELECT first_hour_rate FROM tariffs WHERE vehicle_type = $1 AND is_active = true LIMIT 1
	`, vehicleType).Scan(&baseRate)

	// Auto-assign slot
	slotID := req.SlotID
	if slotID == "" {
		slotType := "regular"
		if vehicleType == "motorcycle" {
			slotType = "motorcycle"
		}
		locFilter := ""
		locArgs := []interface{}{slotType}
		if loc, _ := middleware.GetLocationFilter(c); loc != nil {
			locFilter = "AND location_id = $2"
			locArgs = append(locArgs, *loc)
		}
		h.DB.QueryRow(fmt.Sprintf(`
			SELECT id FROM parking_slots
			WHERE status = 'available' AND type = $1 %s
			ORDER BY slot_number LIMIT 1
		`, locFilter), locArgs...).Scan(&slotID)
	}

	// Create transaction
	ticketNumber := generateTicketNumber()
	operatorID := c.GetString("user_id")

	var gateIDPtr *string
	if req.GateID != "" {
		gateIDPtr = &req.GateID
	}
	var slotIDPtr *string
	if slotID != "" {
		slotIDPtr = &slotID
	}

	locIDFinal, _ := middleware.GetLocationFilter(c)
	var tx models.ParkingTransaction
	var locIDPtr *string
	if locIDFinal != nil { locIDPtr = locIDFinal }
	err = h.DB.QueryRow(`
		INSERT INTO parking_transactions
		(ticket_number, vehicle_id, slot_id, entry_gate_id, plate_number, plate_image_in, base_rate, status, operator_id, location_id)
		VALUES ($1,$2,$3,$4,$5,$6,$7,'active',$8,$9)
		RETURNING id, ticket_number, entry_time, status
	`, ticketNumber, vehicleID, slotIDPtr, gateIDPtr,
		req.PlateNumber, req.PlateImage, baseRate, operatorID, locIDPtr,
	).Scan(&tx.ID, &tx.TicketNumber, &tx.EntryTime, &tx.Status)

	if err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{
			Success: false, Message: "Gagal membuat transaksi", Error: err.Error(),
		})
		return
	}

	// Update slot status
	if slotID != "" {
		h.DB.Exec(`UPDATE parking_slots SET status='occupied' WHERE id=$1`, slotID)
	}

	// FIX: Open entry gate via MQTT (not just DB update)
	if req.GateID != "" {
		var gateName string
		h.DB.QueryRow(`SELECT name FROM gates WHERE id=$1`, req.GateID).Scan(&gateName)
		h.DB.Exec(`UPDATE gates SET status='open', updated_at=NOW() WHERE id=$1`, req.GateID)

		// Publish MQTT command to ESP32
		go config.PublishGateCommand(req.GateID, gateName, "open")

		// Auto-close after 8s
		gateIDCopy := req.GateID
		gateNameCopy := gateName
		go func() {
			time.Sleep(8 * time.Second)
			h.DB.Exec(`UPDATE gates SET status='closed', updated_at=NOW() WHERE id=$1`, gateIDCopy)
			config.PublishGateCommand(gateIDCopy, gateNameCopy, "close")
		}()
	}

	tx.PlateNumber = req.PlateNumber
	tx.BaseRate = baseRate

	c.JSON(http.StatusCreated, models.APIResponse{
		Success: true,
		Message: fmt.Sprintf("Kendaraan %s berhasil masuk. Tiket: %s", req.PlateNumber, ticketNumber),
		Data:    tx,
	})
}

func (h *VehicleHandler) Exit(c *gin.Context) {
	var req models.VehicleExitRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, models.APIResponse{
			Success: false, Message: "Data tidak valid", Error: err.Error(),
		})
		return
	}

	if req.TicketNumber == "" && req.PlateNumber == "" {
		c.JSON(http.StatusBadRequest, models.APIResponse{
			Success: false, Message: "Nomor tiket atau plat nomor wajib diisi",
		})
		return
	}

	// Find active transaction — by ticket number (attended flow) or by plate
	// number (unattended flow: camera/RFID detects the plate, no ticket needed)
	lookupColumn := "t.ticket_number"
	lookupValue := req.TicketNumber
	if lookupValue == "" {
		lookupColumn = "t.plate_number"
		lookupValue = strings.ToUpper(strings.ReplaceAll(req.PlateNumber, " ", ""))
	}

	var tx models.ParkingTransaction
	var slotID *string
	var vehicleType string
	err := h.DB.QueryRow(fmt.Sprintf(`
		SELECT t.id, t.ticket_number, t.vehicle_id, t.slot_id, t.entry_time,
		       t.plate_number, t.base_rate, t.status,
		       COALESCE(v.type, 'car') as vehicle_type
		FROM parking_transactions t
		LEFT JOIN vehicles v ON v.id = t.vehicle_id
		WHERE %s = $1 AND t.status = 'active'
	`, lookupColumn), lookupValue).Scan(
		&tx.ID, &tx.TicketNumber, &tx.VehicleID, &slotID,
		&tx.EntryTime, &tx.PlateNumber, &tx.BaseRate, &tx.Status,
		&vehicleType,
	)

	if err == sql.ErrNoRows {
		c.JSON(http.StatusNotFound, models.APIResponse{
			Success: false, Message: "Tiket tidak ditemukan atau sudah selesai",
		})
		return
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{
			Success: false, Message: "Database error", Error: err.Error(),
		})
		return
	}

	// Calculate fee
	exitTime := time.Now()
	durationMinutes := int(exitTime.Sub(tx.EntryTime).Minutes())
	if durationMinutes < 1 {
		durationMinutes = 1
	}

	var tariff models.Tariff
	h.DB.QueryRow(`
		SELECT first_hour_rate, next_hour_rate, COALESCE(max_daily_rate, 999999)
		FROM tariffs WHERE vehicle_type = $1 AND is_active = true LIMIT 1
	`, vehicleType).Scan(&tariff.FirstHourRate, &tariff.NextHourRate, &tariff.MaxDailyRate)

	if tariff.FirstHourRate == 0 {
		tariff.FirstHourRate = 5000
		tariff.NextHourRate = 3000
		tariff.MaxDailyRate = 50000
	}

	hours := math.Ceil(float64(durationMinutes) / 60.0)
	subtotal := tariff.FirstHourRate
	if hours > 1 {
		subtotal += (hours - 1) * tariff.NextHourRate
	}
	if subtotal > tariff.MaxDailyRate {
		subtotal = tariff.MaxDailyRate
	}

	// Apply member/subscription discount, if this plate has an active membership today
	var memberID *string
	var memberName string
	var discountPercent float64
	h.DB.QueryRow(`
		SELECT id, member_name, discount_percent FROM members
		WHERE plate_number = $1 AND is_active = true
		  AND valid_from <= CURRENT_DATE AND valid_until >= CURRENT_DATE
	`, tx.PlateNumber).Scan(&memberID, &memberName, &discountPercent)

	discountAmount := subtotal * discountPercent / 100
	totalAmount := subtotal - discountAmount

	// Mark transaction completed (status pending payment, gate opens after payment)
	var gateIDPtr *string
	if req.GateID != "" {
		gateIDPtr = &req.GateID
	}

	_, err = h.DB.Exec(`
		UPDATE parking_transactions
		SET exit_time=$1, duration_minutes=$2, total_amount=$3,
		    status='completed', exit_gate_id=$4, plate_image_out=$5,
		    member_id=$6, discount_amount=$7, updated_at=NOW()
		WHERE id=$8
	`, exitTime, durationMinutes, totalAmount, gateIDPtr, req.PlateImage, memberID, discountAmount, tx.ID)

	if err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{
			Success: false, Message: "Gagal memproses keluar", Error: err.Error(),
		})
		return
	}

	// Free the slot
	if slotID != nil {
		h.DB.Exec(`UPDATE parking_slots SET status='available' WHERE id=$1`, *slotID)
	}

	tx.ExitTime = &exitTime
	tx.DurationMinutes = &durationMinutes
	tx.TotalAmount = totalAmount
	tx.Status = "completed"

	message := fmt.Sprintf("Kendaraan berhasil keluar. Total: Rp %.0f", totalAmount)
	if memberID != nil {
		message = fmt.Sprintf("Kendaraan berhasil keluar. Diskon member %s (%.0f%%) diterapkan. Total: Rp %.0f", memberName, discountPercent, totalAmount)
	}

	c.JSON(http.StatusOK, models.APIResponse{
		Success: true,
		Message: message,
		Data: gin.H{
			"transaction":      tx,
			"duration_minutes": durationMinutes,
			"subtotal":         subtotal,
			"discount_percent": discountPercent,
			"discount_amount":  discountAmount,
			"member_name":      memberName,
			"total_amount":     totalAmount,
			"vehicle_type":     vehicleType,
		},
	})
}

func (h *VehicleHandler) ListTransactions(c *gin.Context) {
	status := c.DefaultQuery("status", "")
	limit := c.DefaultQuery("limit", "50")
	offset := c.DefaultQuery("offset", "0")
	locID, isSuper := middleware.GetLocationFilter(c)

	query := `
		SELECT t.id, t.ticket_number, t.plate_number, t.entry_time, t.exit_time,
		       t.duration_minutes, t.total_amount, t.status,
		       COALESCE(s.slot_number, '-') as slot_number,
		       COALESCE(eg.name, '-') as entry_gate_name,
		       COALESCE(xg.name, '-') as exit_gate_name
		FROM parking_transactions t
		LEFT JOIN parking_slots s ON s.id = t.slot_id
		LEFT JOIN gates eg ON eg.id = t.entry_gate_id
		LEFT JOIN gates xg ON xg.id = t.exit_gate_id
	`
	args := []interface{}{}
	argIdx := 1
	conditions := []string{}

	if status != "" {
		conditions = append(conditions, fmt.Sprintf("t.status = $%d", argIdx))
		args = append(args, status)
		argIdx++
	}
	if !isSuper && locID != nil {
		conditions = append(conditions, fmt.Sprintf("t.location_id = $%d", argIdx))
		args = append(args, *locID)
		argIdx++
	}
	if len(conditions) > 0 {
		query += " WHERE " + conditions[0]
		for _, cond := range conditions[1:] {
			query += " AND " + cond
		}
	}
	query += fmt.Sprintf(" ORDER BY t.created_at DESC LIMIT $%d OFFSET $%d", argIdx, argIdx+1)
	args = append(args, limit, offset)

	rows, err := h.DB.Query(query, args...)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{Success: false, Message: "Failed to fetch transactions"})
		return
	}
	defer rows.Close()

	var transactions []models.ParkingTransaction
	for rows.Next() {
		var tx models.ParkingTransaction
		rows.Scan(
			&tx.ID, &tx.TicketNumber, &tx.PlateNumber, &tx.EntryTime, &tx.ExitTime,
			&tx.DurationMinutes, &tx.TotalAmount, &tx.Status,
			&tx.SlotNumber, &tx.EntryGateName, &tx.ExitGateName,
		)
		transactions = append(transactions, tx)
	}

	c.JSON(http.StatusOK, models.APIResponse{Success: true, Data: transactions})
}

func (h *VehicleHandler) GetTransaction(c *gin.Context) {
	id := c.Param("id")
	var tx models.ParkingTransaction
	err := h.DB.QueryRow(`
		SELECT t.id, t.ticket_number, t.plate_number, t.entry_time, t.exit_time,
		       t.duration_minutes, t.total_amount, t.base_rate, t.status,
		       COALESCE(s.slot_number, '-'), COALESCE(eg.name, '-'), COALESCE(xg.name, '-')
		FROM parking_transactions t
		LEFT JOIN parking_slots s ON s.id = t.slot_id
		LEFT JOIN gates eg ON eg.id = t.entry_gate_id
		LEFT JOIN gates xg ON xg.id = t.exit_gate_id
		WHERE t.id = $1 OR t.ticket_number = $1
	`, id).Scan(
		&tx.ID, &tx.TicketNumber, &tx.PlateNumber, &tx.EntryTime, &tx.ExitTime,
		&tx.DurationMinutes, &tx.TotalAmount, &tx.BaseRate, &tx.Status,
		&tx.SlotNumber, &tx.EntryGateName, &tx.ExitGateName,
	)
	if err == sql.ErrNoRows {
		c.JSON(http.StatusNotFound, models.APIResponse{Success: false, Message: "Transaksi tidak ditemukan"})
		return
	}
	c.JSON(http.StatusOK, models.APIResponse{Success: true, Data: tx})
}
