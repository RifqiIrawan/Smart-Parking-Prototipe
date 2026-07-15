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
		c.JSON(http.StatusBadRequest, models.APIResponse{
			Success: false,
			Message: "Invalid request body",
			Error:   err.Error(),
		})
		return
	}

	var user models.User
	var hashedPassword string
	err := h.DB.QueryRow(`
		SELECT u.id, u.name, u.email, u.password, u.role_id, r.name as role_name, u.is_active
		FROM users u
		JOIN roles r ON r.id = u.role_id
		WHERE u.email = $1 AND u.is_active = true
	`, req.Email).Scan(&user.ID, &user.Name, &user.Email, &hashedPassword, &user.RoleID, &user.RoleName, &user.IsActive)

	if err == sql.ErrNoRows {
		c.JSON(http.StatusUnauthorized, models.APIResponse{
			Success: false,
			Message: "Email atau password salah",
		})
		return
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{
			Success: false,
			Message: "Database error",
			Error:   err.Error(),
		})
		return
	}

	if err := bcrypt.CompareHashAndPassword([]byte(hashedPassword), []byte(req.Password)); err != nil {
		c.JSON(http.StatusUnauthorized, models.APIResponse{
			Success: false,
			Message: "Email atau password salah",
		})
		return
	}

	token, err := config.GenerateToken(user.ID, user.Email, user.RoleName)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{
			Success: false,
			Message: "Failed to generate token",
		})
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
		SELECT u.id, u.name, u.email, u.role_id, r.name as role_name, u.is_active, u.created_at
		FROM users u
		JOIN roles r ON r.id = u.role_id
		WHERE u.id = $1
	`, userID).Scan(&user.ID, &user.Name, &user.Email, &user.RoleID, &user.RoleName, &user.IsActive, &user.CreatedAt)

	if err != nil {
		c.JSON(http.StatusNotFound, models.APIResponse{
			Success: false,
			Message: "User not found",
		})
		return
	}

	c.JSON(http.StatusOK, models.APIResponse{
		Success: true,
		Data:    user,
	})
}
