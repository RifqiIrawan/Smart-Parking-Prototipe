package handlers

import (
	"database/sql"
	"fmt"
	"net/http"
	"time"

	"github.com/RifqiIrawan/smart-parking/backend/models"
	"github.com/gin-gonic/gin"
	"github.com/xuri/excelize/v2"
	"golang.org/x/crypto/bcrypt"
)

type UserHandler struct {
	DB *sql.DB
}

func NewUserHandler(db *sql.DB) *UserHandler {
	return &UserHandler{DB: db}
}

func (h *UserHandler) ListUsers(c *gin.Context) {
	rows, err := h.DB.Query(`
		SELECT u.id, u.name, u.email, u.role_id, r.name, u.is_active, u.created_at
		FROM users u JOIN roles r ON r.id = u.role_id ORDER BY u.created_at DESC
	`)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{Success: false, Message: "Failed"})
		return
	}
	defer rows.Close()

	var users []models.User
	for rows.Next() {
		var u models.User
		rows.Scan(&u.ID, &u.Name, &u.Email, &u.RoleID, &u.RoleName, &u.IsActive, &u.CreatedAt)
		users = append(users, u)
	}
	c.JSON(http.StatusOK, models.APIResponse{Success: true, Data: users})
}

func (h *UserHandler) CreateUser(c *gin.Context) {
	var body struct {
		Name     string `json:"name" binding:"required"`
		Email    string `json:"email" binding:"required,email"`
		Password string `json:"password" binding:"required,min=6"`
		RoleID   int    `json:"role_id"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, models.APIResponse{Success: false, Message: err.Error()})
		return
	}

	hashed, err := bcrypt.GenerateFromPassword([]byte(body.Password), bcrypt.DefaultCost)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{Success: false, Message: "Failed to hash password"})
		return
	}

	roleID := body.RoleID
	if roleID == 0 {
		roleID = 2 // operator
	}

	var userID string
	err = h.DB.QueryRow(`
		INSERT INTO users (name, email, password, role_id) VALUES ($1,$2,$3,$4) RETURNING id
	`, body.Name, body.Email, string(hashed), roleID).Scan(&userID)

	if err != nil {
		c.JSON(http.StatusConflict, models.APIResponse{Success: false, Message: "Email sudah terdaftar"})
		return
	}

	c.JSON(http.StatusCreated, models.APIResponse{
		Success: true,
		Message: "User created",
		Data:    gin.H{"id": userID},
	})
}

func (h *UserHandler) UpdateUser(c *gin.Context) {
	id := c.Param("id")
	var body struct {
		Name     string `json:"name"`
		RoleID   int    `json:"role_id"`
		IsActive *bool  `json:"is_active"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, models.APIResponse{Success: false, Message: err.Error()})
		return
	}

	_, err := h.DB.Exec(`
		UPDATE users SET name=$1, role_id=$2, is_active=$3, updated_at=NOW() WHERE id=$4
	`, body.Name, body.RoleID, body.IsActive, id)

	if err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{Success: false, Message: err.Error()})
		return
	}
	c.JSON(http.StatusOK, models.APIResponse{Success: true, Message: "User updated"})
}

func (h *UserHandler) DeleteUser(c *gin.Context) {
	id := c.Param("id")
	currentUserID := c.GetString("user_id")

	if id == currentUserID {
		c.JSON(http.StatusBadRequest, models.APIResponse{Success: false, Message: "Tidak bisa menghapus akun sendiri"})
		return
	}

	h.DB.Exec(`UPDATE users SET is_active=false WHERE id=$1`, id)
	c.JSON(http.StatusOK, models.APIResponse{Success: true, Message: "User deactivated"})
}

func (h *UserHandler) GetSlots(c *gin.Context) {
	status := c.DefaultQuery("status", "")
	zone := c.DefaultQuery("zone", "")

	query := `SELECT id, slot_number, floor, zone, type, status FROM parking_slots WHERE 1=1`
	args := []interface{}{}
	i := 1

	if status != "" {
		query += ` AND status = $` + string(rune('0'+i))
		args = append(args, status)
		i++
	}
	if zone != "" {
		query += ` AND zone = $` + string(rune('0'+i))
		args = append(args, zone)
	}
	query += " ORDER BY zone, slot_number"

	rows, _ := h.DB.Query(query, args...)
	if rows != nil {
		defer rows.Close()
	}

	var slots []models.ParkingSlot
	if rows != nil {
		for rows.Next() {
			var s models.ParkingSlot
			rows.Scan(&s.ID, &s.SlotNumber, &s.Floor, &s.Zone, &s.Type, &s.Status)
			slots = append(slots, s)
		}
	}
	c.JSON(http.StatusOK, models.APIResponse{Success: true, Data: slots})
}

func (h *UserHandler) ListRoles(c *gin.Context) {
	rows, _ := h.DB.Query(`SELECT id, name FROM roles ORDER BY id`)
	if rows == nil {
		c.JSON(http.StatusOK, models.APIResponse{Success: true, Data: []interface{}{}})
		return
	}
	defer rows.Close()

	type Role struct {
		ID   int    `json:"id"`
		Name string `json:"name"`
	}
	var roles []Role
	for rows.Next() {
		var r Role
		rows.Scan(&r.ID, &r.Name)
		roles = append(roles, r)
	}
	c.JSON(http.StatusOK, models.APIResponse{Success: true, Data: roles})
}

type ReportRow struct {
	Period            string  `json:"period"`
	TotalTransactions int     `json:"total_transactions"`
	Completed         int     `json:"completed"`
	Revenue           float64 `json:"revenue"`
	DiscountGiven     float64 `json:"discount_given"`
}

// fetchReportRows is shared by GetReports (JSON for the UI) and ExportReports
// (Excel download) so the two can never drift out of sync with each other.
func fetchReportRows(db *sql.DB, period string) ([]ReportRow, error) {
	// FIX: the lookback window must scale with the grouping — a monthly
	// report capped at 30 days can never show more than the current month,
	// which made the "Bulanan" tab effectively identical to "Harian".
	var groupBy, dateFormat, lookback string
	switch period {
	case "monthly":
		groupBy = "DATE_TRUNC('month', entry_time)"
		dateFormat = "YYYY-MM"
		lookback = "12 months"
	default: // daily
		groupBy = "DATE(entry_time)"
		dateFormat = "YYYY-MM-DD"
		lookback = "30 days"
	}

	rows, err := db.Query(fmt.Sprintf(`
		SELECT
			TO_CHAR(%s, '%s') as period,
			COUNT(*) as total_transactions,
			COUNT(CASE WHEN status='completed' THEN 1 END) as completed,
			COALESCE(SUM(CASE WHEN status='completed' THEN total_amount END), 0) as revenue,
			COALESCE(SUM(CASE WHEN status='completed' THEN discount_amount END), 0) as discount_given
		FROM parking_transactions
		WHERE entry_time >= NOW() - INTERVAL '%s'
		GROUP BY %s
		ORDER BY period DESC
		LIMIT 30
	`, groupBy, dateFormat, lookback, groupBy))
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var reports []ReportRow
	for rows.Next() {
		var r ReportRow
		if err := rows.Scan(&r.Period, &r.TotalTransactions, &r.Completed, &r.Revenue, &r.DiscountGiven); err != nil {
			return nil, err
		}
		reports = append(reports, r)
	}
	return reports, nil
}

func (h *UserHandler) GetReports(c *gin.Context) {
	period := c.DefaultQuery("period", "daily")

	reports, err := fetchReportRows(h.DB, period)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{Success: false, Message: err.Error()})
		return
	}

	c.JSON(http.StatusOK, models.APIResponse{Success: true, Data: reports})
}

// ExportReports streams the same report data as a real .xlsx workbook.
func (h *UserHandler) ExportReports(c *gin.Context) {
	period := c.DefaultQuery("period", "daily")

	reports, err := fetchReportRows(h.DB, period)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{Success: false, Message: err.Error()})
		return
	}

	f := excelize.NewFile()
	defer f.Close()
	sheet := "Laporan"
	f.SetSheetName("Sheet1", sheet)

	headerStyle, _ := f.NewStyle(&excelize.Style{
		Font: &excelize.Font{Bold: true, Color: "FFFFFF"},
		Fill: excelize.Fill{Type: "pattern", Color: []string{"0EA5E9"}, Pattern: 1},
	})

	headers := []string{"Periode", "Total Transaksi", "Selesai", "Diskon Member (Rp)", "Pendapatan (Rp)"}
	for i, hdr := range headers {
		col, _ := excelize.CoordinatesToCellName(i+1, 1)
		f.SetCellValue(sheet, col, hdr)
	}
	f.SetCellStyle(sheet, "A1", "E1", headerStyle)

	for i, r := range reports {
		row := i + 2
		f.SetCellValue(sheet, fmt.Sprintf("A%d", row), r.Period)
		f.SetCellValue(sheet, fmt.Sprintf("B%d", row), r.TotalTransactions)
		f.SetCellValue(sheet, fmt.Sprintf("C%d", row), r.Completed)
		f.SetCellValue(sheet, fmt.Sprintf("D%d", row), r.DiscountGiven)
		f.SetCellValue(sheet, fmt.Sprintf("E%d", row), r.Revenue)
	}
	f.SetColWidth(sheet, "A", "A", 14)
	f.SetColWidth(sheet, "B", "E", 18)

	periodLabel := "harian"
	if period == "monthly" {
		periodLabel = "bulanan"
	}
	filename := fmt.Sprintf("laporan-%s-%s.xlsx", periodLabel, time.Now().Format("2006-01-02"))

	c.Header("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
	c.Header("Content-Disposition", "attachment; filename="+filename)
	if err := f.Write(c.Writer); err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{Success: false, Message: "Gagal membuat file Excel"})
		return
	}
}
