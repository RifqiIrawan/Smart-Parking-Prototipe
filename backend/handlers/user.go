package handlers

import (
	"database/sql"
	"net/http"

	"github.com/RifqiIrawan/smart-parking/backend/models"
	"github.com/gin-gonic/gin"
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

func (h *UserHandler) GetReports(c *gin.Context) {
	period := c.DefaultQuery("period", "daily")

	var groupBy, dateFormat string
	switch period {
	case "monthly":
		groupBy = "DATE_TRUNC('month', entry_time)"
		dateFormat = "YYYY-MM"
	default: // daily
		groupBy = "DATE(entry_time)"
		dateFormat = "YYYY-MM-DD"
	}

	rows, err := h.DB.Query(fmt.Sprintf(`
		SELECT
			TO_CHAR(%s, '%s') as period,
			COUNT(*) as total_transactions,
			COUNT(CASE WHEN status='completed' THEN 1 END) as completed,
			COALESCE(SUM(CASE WHEN status='completed' THEN total_amount END), 0) as revenue
		FROM parking_transactions
		WHERE entry_time >= NOW() - INTERVAL '30 days'
		GROUP BY %s
		ORDER BY period DESC
		LIMIT 30
	`, groupBy, dateFormat, groupBy))

	if err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{Success: false, Message: err.Error()})
		return
	}
	defer rows.Close()

	type Report struct {
		Period            string  `json:"period"`
		TotalTransactions int     `json:"total_transactions"`
		Completed         int     `json:"completed"`
		Revenue           float64 `json:"revenue"`
	}

	var reports []Report
	for rows.Next() {
		var r Report
		rows.Scan(&r.Period, &r.TotalTransactions, &r.Completed, &r.Revenue)
		reports = append(reports, r)
	}

	c.JSON(http.StatusOK, models.APIResponse{Success: true, Data: reports})
}

// needed for fmt in GetReports
var _ = fmt.Sprintf
