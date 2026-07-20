package handlers

import (
	"database/sql"
	"fmt"
	"math"
	"net/http"
	"strings"
	"time"

	"github.com/RifqiIrawan/smart-parking/backend/models"
	"github.com/gin-gonic/gin"
)

type BillingHandler struct {
	DB *sql.DB
}

func NewBillingHandler(db *sql.DB) *BillingHandler {
	return &BillingHandler{DB: db}
}

type BillingResult struct {
	// Transaction
	TransactionID   string    `json:"transaction_id"`
	TicketNumber    string    `json:"ticket_number"`
	PlateNumber     string    `json:"plate_number"`
	VehicleType     string    `json:"vehicle_type"`
	EntryTime       time.Time `json:"entry_time"`
	Status          string    `json:"status"`

	// Location info
	SlotNumber    string `json:"slot_number"`
	EntryGateName string `json:"entry_gate_name"`
	LocationName  string `json:"location_name"`
	LocationCode  string `json:"location_code"`

	// Real-time fee
	DurationMinutes int     `json:"duration_minutes"`
	DurationDisplay string  `json:"duration_display"`
	CurrentFee      float64 `json:"current_fee"`
	BaseRate        float64 `json:"base_rate"`
	NextHourRate    float64 `json:"next_hour_rate"`
	MaxDailyRate    float64 `json:"max_daily_rate"`

	// Pending payment (if exists)
	PendingPayment *PendingPaymentInfo `json:"pending_payment,omitempty"`
}

type PendingPaymentInfo struct {
	PaymentID     string  `json:"payment_id"`
	OrderID       string  `json:"order_id"`
	Amount        float64 `json:"amount"`
	Method        string  `json:"method"`
	Status        string  `json:"status"`
	ExpiredAt     string  `json:"expired_at"`
}

// CheckBilling — lookup by plate number or ticket number, return live fee
func (h *BillingHandler) CheckBilling(c *gin.Context) {
	plate  := strings.ToUpper(strings.ReplaceAll(c.Query("plate"),  " ", ""))
	ticket := strings.ToUpper(c.Query("ticket"))

	if plate == "" && ticket == "" {
		c.JSON(http.StatusBadRequest, models.APIResponse{
			Success: false,
			Message: "Parameter 'plate' atau 'ticket' wajib diisi",
		})
		return
	}

	// Build lookup
	whereClause := ""
	lookupVal   := ""
	if ticket != "" {
		whereClause = "t.ticket_number = $1"
		lookupVal   = ticket
	} else {
		whereClause = "REPLACE(UPPER(t.plate_number), ' ', '') = $1"
		lookupVal   = plate
	}

	var result BillingResult
	var vehicleType string

	err := h.DB.QueryRow(fmt.Sprintf(`
		SELECT
			t.id, t.ticket_number, t.plate_number,
			t.entry_time, t.status, t.base_rate,
			COALESCE(v.type, 'car')   AS vehicle_type,
			COALESCE(s.slot_number, '-')   AS slot_number,
			COALESCE(eg.name, '-')         AS entry_gate_name,
			COALESCE(l.name, '-')          AS location_name,
			COALESCE(l.code, '')           AS location_code
		FROM parking_transactions t
		LEFT JOIN vehicles v  ON v.id  = t.vehicle_id
		LEFT JOIN parking_slots s ON s.id = t.slot_id
		LEFT JOIN gates eg    ON eg.id = t.entry_gate_id
		LEFT JOIN locations l ON l.id  = t.location_id
		WHERE %s AND t.status = 'active'
		ORDER BY t.entry_time DESC
		LIMIT 1
	`, whereClause), lookupVal).Scan(
		&result.TransactionID, &result.TicketNumber, &result.PlateNumber,
		&result.EntryTime, &result.Status, &result.BaseRate,
		&vehicleType,
		&result.SlotNumber, &result.EntryGateName,
		&result.LocationName, &result.LocationCode,
	)

	if err == sql.ErrNoRows {
		msg := fmt.Sprintf("Kendaraan dengan plat '%s' tidak sedang parkir", plate)
		if ticket != "" {
			msg = fmt.Sprintf("Tiket '%s' tidak ditemukan atau sudah selesai", ticket)
		}
		c.JSON(http.StatusNotFound, models.APIResponse{Success: false, Message: msg})
		return
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{Success: false, Message: err.Error()})
		return
	}

	result.VehicleType = vehicleType

	// Get tariff for vehicle type
	var tariff models.Tariff
	h.DB.QueryRow(`
		SELECT first_hour_rate, next_hour_rate, COALESCE(max_daily_rate, 999999)
		FROM tariffs
		WHERE vehicle_type = $1 AND is_active = true
		ORDER BY CASE WHEN location_id = (
			SELECT location_id FROM parking_transactions WHERE id = $2
		) THEN 0 ELSE 1 END
		LIMIT 1
	`, vehicleType, result.TransactionID).Scan(
		&tariff.FirstHourRate, &tariff.NextHourRate, &tariff.MaxDailyRate,
	)

	// Defaults if no tariff found
	if tariff.FirstHourRate == 0 {
		switch vehicleType {
		case "motorcycle":
			tariff.FirstHourRate = 2000; tariff.NextHourRate = 1000; tariff.MaxDailyRate = 20000
		case "truck":
			tariff.FirstHourRate = 10000; tariff.NextHourRate = 5000; tariff.MaxDailyRate = 100000
		default: // car
			tariff.FirstHourRate = 5000; tariff.NextHourRate = 3000; tariff.MaxDailyRate = 50000
		}
	}

	result.BaseRate     = tariff.FirstHourRate
	result.NextHourRate = tariff.NextHourRate
	result.MaxDailyRate = tariff.MaxDailyRate

	// Calculate live fee (to current moment)
	now             := time.Now()
	durationMinutes := int(now.Sub(result.EntryTime).Minutes())
	if durationMinutes < 1 { durationMinutes = 1 }

	hours       := math.Ceil(float64(durationMinutes) / 60.0)
	currentFee  := tariff.FirstHourRate
	if hours > 1 {
		currentFee += (hours - 1) * tariff.NextHourRate
	}
	if currentFee > tariff.MaxDailyRate {
		currentFee = tariff.MaxDailyRate
	}

	result.DurationMinutes = durationMinutes
	result.CurrentFee      = currentFee

	// Format duration human-readable
	hh := durationMinutes / 60
	mm := durationMinutes % 60
	if hh > 0 {
		result.DurationDisplay = fmt.Sprintf("%d jam %d menit", hh, mm)
	} else {
		result.DurationDisplay = fmt.Sprintf("%d menit", mm)
	}

	// Check pending payment
	var pp PendingPaymentInfo
	ppErr := h.DB.QueryRow(`
		SELECT id, COALESCE(gateway_order_id,''), amount, payment_method, status,
		       COALESCE(TO_CHAR(expired_at, 'YYYY-MM-DD"T"HH24:MI:SS'), '')
		FROM payments
		WHERE transaction_id = $1 AND status IN ('pending','created')
		ORDER BY created_at DESC LIMIT 1
	`, result.TransactionID).Scan(
		&pp.PaymentID, &pp.OrderID, &pp.Amount, &pp.Method, &pp.Status, &pp.ExpiredAt,
	)
	if ppErr == nil && pp.PaymentID != "" {
		result.PendingPayment = &pp
	}

	c.JSON(http.StatusOK, models.APIResponse{
		Success: true,
		Message: fmt.Sprintf("Kendaraan %s ditemukan", result.PlateNumber),
		Data:    result,
	})
}

// ListBillingActive — semua kendaraan yang sedang parkir dengan tagihan live
func (h *BillingHandler) ListBillingActive(c *gin.Context) {
	locFilter := c.Query("location_id")

	query := `
		SELECT
			t.id, t.ticket_number, t.plate_number, t.entry_time, t.base_rate,
			COALESCE(v.type, 'car')       AS vehicle_type,
			COALESCE(s.slot_number, '-')  AS slot_number,
			COALESCE(eg.name, '-')        AS entry_gate_name,
			COALESCE(l.name, '-')         AS location_name,
			COALESCE(p.status, '')        AS payment_status
		FROM parking_transactions t
		LEFT JOIN vehicles v     ON v.id  = t.vehicle_id
		LEFT JOIN parking_slots s ON s.id = t.slot_id
		LEFT JOIN gates eg        ON eg.id = t.entry_gate_id
		LEFT JOIN locations l     ON l.id  = t.location_id
		LEFT JOIN payments p      ON p.transaction_id = t.id AND p.status IN ('pending','created')
		WHERE t.status = 'active'
	`
	args := []interface{}{}
	if locFilter != "" {
		query += " AND t.location_id = $1"
		args = append(args, locFilter)
	}
	query += " ORDER BY t.entry_time ASC"

	rows, err := h.DB.Query(query, args...)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{Success: false, Message: err.Error()})
		return
	}
	defer rows.Close()

	type ActiveBill struct {
		TransactionID   string    `json:"transaction_id"`
		TicketNumber    string    `json:"ticket_number"`
		PlateNumber     string    `json:"plate_number"`
		VehicleType     string    `json:"vehicle_type"`
		EntryTime       time.Time `json:"entry_time"`
		DurationMinutes int       `json:"duration_minutes"`
		DurationDisplay string    `json:"duration_display"`
		EstimatedFee    float64   `json:"estimated_fee"`
		SlotNumber      string    `json:"slot_number"`
		EntryGateName   string    `json:"entry_gate_name"`
		LocationName    string    `json:"location_name"`
		PaymentStatus   string    `json:"payment_status"`
	}

	var bills []ActiveBill
	now := time.Now()

	for rows.Next() {
		var b ActiveBill
		var baseRate float64
		rows.Scan(
			&b.TransactionID, &b.TicketNumber, &b.PlateNumber,
			&b.EntryTime, &baseRate,
			&b.VehicleType, &b.SlotNumber, &b.EntryGateName,
			&b.LocationName, &b.PaymentStatus,
		)

		mins := int(now.Sub(b.EntryTime).Minutes())
		if mins < 1 { mins = 1 }
		b.DurationMinutes = mins

		hrs_ := mins / 60; mins_ := mins % 60
		if hrs_ > 0 { b.DurationDisplay = fmt.Sprintf("%dj %dm", hrs_, mins_) } else { b.DurationDisplay = fmt.Sprintf("%dm", mins_) }

		// Quick fee estimate
		hrs := math.Ceil(float64(mins) / 60.0)
		nextRate := baseRate * 0.6
		b.EstimatedFee = baseRate
		if hrs > 1 { b.EstimatedFee += (hrs - 1) * nextRate }

		bills = append(bills, b)
	}

	c.JSON(http.StatusOK, models.APIResponse{
		Success: true,
		Data:    bills,
		Message: fmt.Sprintf("%d kendaraan aktif", len(bills)),
	})
}
