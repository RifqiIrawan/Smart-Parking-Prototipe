package handlers

import (
	"database/sql"
	"fmt"
	"net/http"

	"github.com/RifqiIrawan/smart-parking/backend/middleware"
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
	locID, isSuper := middleware.GetLocationFilter(c)

	whereClause := ""
	var args []interface{}
	argIdx := 1

	if !isSuper && locID != nil {
		whereClause = fmt.Sprintf("WHERE location_id = $%d", argIdx)
		args = append(args, *locID)
		argIdx++
	}

	var stats models.DashboardStats

	// Slots
	h.DB.QueryRow(fmt.Sprintf(`
		SELECT
			COUNT(*) AS total,
			COUNT(*) FILTER (WHERE status='available') AS available,
			COUNT(*) FILTER (WHERE status='occupied')  AS occupied
		FROM parking_slots %s
	`, whereClause), args...).Scan(
		&stats.TotalSlots, &stats.AvailableSlots, &stats.OccupiedSlots,
	)

	// Transactions
	txWhere := whereClause
	if txWhere == "" {
		txWhere = "WHERE 1=1"
	}
	h.DB.QueryRow(fmt.Sprintf(`
		SELECT
			COUNT(*) FILTER (WHERE status='active')          AS active,
			COUNT(*) FILTER (WHERE entry_time::date = CURRENT_DATE) AS today_count
		FROM parking_transactions %s
	`, txWhere), args...).Scan(
		&stats.ActiveTransactions, &stats.TodayTransactions,
	)

	// Revenue
	payWhere := "WHERE p.status='paid'"
	payArgs := []interface{}{}
	if !isSuper && locID != nil {
		payWhere = "WHERE p.status='paid' AND t.location_id = $1"
		payArgs = []interface{}{*locID}
	}

	h.DB.QueryRow(fmt.Sprintf(`
		SELECT
			COALESCE(SUM(p.amount) FILTER (WHERE p.paid_at::date = CURRENT_DATE),  0) AS today,
			COALESCE(SUM(p.amount) FILTER (WHERE DATE_TRUNC('month', p.paid_at) = DATE_TRUNC('month', NOW())), 0) AS month
		FROM payments p
		JOIN parking_transactions t ON t.id = p.transaction_id
		%s
	`, payWhere), payArgs...).Scan(&stats.TodayRevenue, &stats.MonthRevenue)

	if stats.TotalSlots > 0 {
		stats.OccupancyRate = float64(stats.OccupiedSlots) / float64(stats.TotalSlots) * 100
	}

	// Location info
	if !isSuper && locID != nil {
		stats.LocationID = locID
		var locName string
		h.DB.QueryRow(`SELECT name FROM locations WHERE id=$1`, *locID).Scan(&locName)
		stats.LocationName = locName
	}

	c.JSON(http.StatusOK, models.APIResponse{Success: true, Data: stats})
}

func (h *DashboardHandler) GetRevenueChart(c *gin.Context) {
	locID, isSuper := middleware.GetLocationFilter(c)

	payWhere := "WHERE p.status='paid'"
	var args []interface{}
	if !isSuper && locID != nil {
		payWhere = "WHERE p.status='paid' AND t.location_id=$1"
		args = append(args, *locID)
	}

	rows, err := h.DB.Query(fmt.Sprintf(`
		SELECT
			TO_CHAR(p.paid_at, 'DD Mon') AS label,
			COALESCE(SUM(p.amount), 0)   AS revenue,
			COUNT(*) AS transactions
		FROM payments p
		JOIN parking_transactions t ON t.id = p.transaction_id
		%s
		  AND p.paid_at >= NOW() - INTERVAL '30 days'
		GROUP BY p.paid_at::date
		ORDER BY p.paid_at::date
	`, payWhere), args...)

	if err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{Success: false, Message: err.Error()})
		return
	}
	defer rows.Close()

	type DataPoint struct {
		Label        string  `json:"label"`
		Revenue      float64 `json:"revenue"`
		Transactions int     `json:"transactions"`
	}
	var data []DataPoint
	for rows.Next() {
		var d DataPoint
		rows.Scan(&d.Label, &d.Revenue, &d.Transactions)
		data = append(data, d)
	}
	c.JSON(http.StatusOK, models.APIResponse{Success: true, Data: data})
}

func (h *DashboardHandler) GetSlotMap(c *gin.Context) {
	locID, isSuper := middleware.GetLocationFilter(c)

	whereClause := ""
	var args []interface{}
	if !isSuper && locID != nil {
		whereClause = "WHERE location_id = $1"
		args = append(args, *locID)
	}

	rows, err := h.DB.Query(fmt.Sprintf(`
		SELECT id, slot_number, floor, zone, type, status
		FROM parking_slots %s
		ORDER BY floor, zone, slot_number
	`, whereClause), args...)

	if err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{Success: false, Message: err.Error()})
		return
	}
	defer rows.Close()

	var slots []models.ParkingSlot
	for rows.Next() {
		var s models.ParkingSlot
		rows.Scan(&s.ID, &s.SlotNumber, &s.Floor, &s.Zone, &s.Type, &s.Status)
		slots = append(slots, s)
	}
	c.JSON(http.StatusOK, models.APIResponse{Success: true, Data: slots})
}
