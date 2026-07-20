package handlers

import (
	"database/sql"
	"net/http"

	"github.com/RifqiIrawan/smart-parking/backend/config"
	"github.com/RifqiIrawan/smart-parking/backend/models"
	"github.com/gin-gonic/gin"
	"golang.org/x/crypto/bcrypt"
)

type AuthHandler struct {
	DB *sql.DB
}

func NewAuthHandler(db *sql.DB) *AuthHandler {
	return &AuthHandler{DB: db}
}

func (h *AuthHandler) Login(c *gin.Context) {
	var req models.LoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, models.APIResponse{Success: false, Message: err.Error()})
		return
	}

	var user models.User
	var hashedPassword string
	err := h.DB.QueryRow(`
		SELECT u.id, u.name, u.email, u.password, u.role_id,
		       r.name AS role_name,
		       u.location_id,
		       COALESCE(l.name, '') AS location_name,
		       COALESCE(l.code, '') AS location_code,
		       u.is_active
		FROM users u
		JOIN roles r ON r.id = u.role_id
		LEFT JOIN locations l ON l.id = u.location_id
		WHERE u.email = $1
	`, req.Email).Scan(
		&user.ID, &user.Name, &user.Email, &hashedPassword,
		&user.RoleID, &user.RoleName,
		&user.LocationID, &user.LocationName, &user.LocationCode,
		&user.IsActive,
	)

	if err == sql.ErrNoRows {
		c.JSON(http.StatusUnauthorized, models.APIResponse{Success: false, Message: "Email atau password salah"})
		return
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{Success: false, Message: "Database error"})
		return
	}
	if !user.IsActive {
		c.JSON(http.StatusForbidden, models.APIResponse{Success: false, Message: "Akun tidak aktif"})
		return
	}

	if err := bcrypt.CompareHashAndPassword([]byte(hashedPassword), []byte(req.Password)); err != nil {
		c.JSON(http.StatusUnauthorized, models.APIResponse{Success: false, Message: "Email atau password salah"})
		return
	}

	// Generate token with location embedded
	token, err := config.GenerateToken(user.ID, user.Email, user.RoleName, user.LocationID, user.LocationCode)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{Success: false, Message: "Gagal membuat token"})
		return
	}

	c.JSON(http.StatusOK, models.APIResponse{
		Success: true,
		Message: "Login berhasil",
		Data: gin.H{
			"token": token,
			"user":  user,
		},
	})
}

func (h *AuthHandler) Me(c *gin.Context) {
	userID := c.GetString("user_id")

	var user models.User
	err := h.DB.QueryRow(`
		SELECT u.id, u.name, u.email, u.role_id,
		       r.name AS role_name,
		       u.location_id,
		       COALESCE(l.name, '') AS location_name,
		       COALESCE(l.code, '') AS location_code,
		       u.is_active, u.created_at, u.updated_at
		FROM users u
		JOIN roles r ON r.id = u.role_id
		LEFT JOIN locations l ON l.id = u.location_id
		WHERE u.id = $1
	`, userID).Scan(
		&user.ID, &user.Name, &user.Email, &user.RoleID, &user.RoleName,
		&user.LocationID, &user.LocationName, &user.LocationCode,
		&user.IsActive, &user.CreatedAt, &user.UpdatedAt,
	)

	if err != nil {
		c.JSON(http.StatusNotFound, models.APIResponse{Success: false, Message: "User tidak ditemukan"})
		return
	}
	c.JSON(http.StatusOK, models.APIResponse{Success: true, Data: user})
}
