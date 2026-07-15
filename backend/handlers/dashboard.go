package handlers

import (
	"database/sql"
	"net/http"

	"github.com/RifqiIrawan/smart-parking/backend/models"
	"github.com/gin-gonic/gin"
)

type DashboardHandler struct {
	DB *sql.DB
}

func NewDashboardHandler(db *sql.DB) *DashboardHandler {
	return &DashboardHandler{DB: db}
}

func (h *DashboardHandler) GetStats(c *gin.Context) {
	var stats models.DashboardStats

	// Slot stats
	h.DB.QueryRow(`SELECT COUNT(*) FROM parking_slots`).Scan(&stats.TotalSlots)
	h.DB.QueryRow(`SELECT COUNT(*) FROM parking_slots WHERE status = 'available'`).Scan(&stats.AvailableSlots)
	h.DB.QueryRow(`SELECT COUNT(*) FROM parking_slots WHERE status = 'occupied'`).Scan(&stats.OccupiedSlots)

	// Active transactions
	h.DB.QueryRow(`SELECT COUNT(*) FROM parking_transactions WHERE status = 'active'`).Scan(&stats.ActiveTransactions)

	// Today revenue
	h.DB.QueryRow(`
		SELECT COALESCE(SUM(p.amount), 0)
		FROM payments p
		WHERE p.status = 'paid'
		AND DATE(p.paid_at) = CURRENT_DATE
	`).Scan(&stats.TodayRevenue)

	// Today transactions
	h.DB.QueryRow(`
		SELECT COUNT(*) FROM parking_transactions
		WHERE DATE(entry_time) = CURRENT_DATE
	`).Scan(&stats.TodayTransactions)

	// Month revenue
	h.DB.QueryRow(`
		SELECT COALESCE(SUM(p.amount), 0)
		FROM payments p
		WHERE p.status = 'paid'
		AND DATE_TRUNC('month', p.paid_at) = DATE_TRUNC('month', CURRENT_DATE)
	`).Scan(&stats.MonthRevenue)

	if stats.TotalSlots > 0 {
		stats.OccupancyRate = float64(stats.OccupiedSlots) / float64(stats.TotalSlots) * 100
	}

	c.JSON(http.StatusOK, models.APIResponse{
		Success: true,
		Data:    stats,
	})
}

func (h *DashboardHandler) GetRevenueChart(c *gin.Context) {
	rows, err := h.DB.Query(`
		SELECT
			TO_CHAR(paid_at, 'YYYY-MM-DD') as date,
			COALESCE(SUM(amount), 0) as revenue,
			COUNT(*) as transactions
		FROM payments
		WHERE status = 'paid'
		AND paid_at >= NOW() - INTERVAL '30 days'
		GROUP BY DATE(paid_at)
		ORDER BY date
	`)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{
			Success: false,
			Message: "Failed to fetch revenue data",
		})
		return
	}
	defer rows.Close()

	type RevenuePoint struct {
		Date         string  `json:"date"`
		Revenue      float64 `json:"revenue"`
		Transactions int     `json:"transactions"`
	}

	var data []RevenuePoint
	for rows.Next() {
		var p RevenuePoint
		rows.Scan(&p.Date, &p.Revenue, &p.Transactions)
		data = append(data, p)
	}

	c.JSON(http.StatusOK, models.APIResponse{
		Success: true,
		Data:    data,
	})
}

func (h *DashboardHandler) GetSlotMap(c *gin.Context) {
	rows, err := h.DB.Query(`
		SELECT id, slot_number, floor, zone, type, status
		FROM parking_slots
		ORDER BY zone, slot_number
	`)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{
			Success: false,
			Message: "Failed to fetch slot map",
		})
		return
	}
	defer rows.Close()

	var slots []models.ParkingSlot
	for rows.Next() {
		var s models.ParkingSlot
		rows.Scan(&s.ID, &s.SlotNumber, &s.Floor, &s.Zone, &s.Type, &s.Status)
		slots = append(slots, s)
	}

	c.JSON(http.StatusOK, models.APIResponse{
		Success: true,
		Data:    slots,
	})
}
