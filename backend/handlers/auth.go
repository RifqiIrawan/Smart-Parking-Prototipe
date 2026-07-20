package handlers

import (
	"database/sql"
	"fmt"
	"log"
	"net/http"
	"time"

	"github.com/RifqiIrawan/smart-parking/backend/config"
	"github.com/RifqiIrawan/smart-parking/backend/models"
	"github.com/gin-gonic/gin"
	"golang.org/x/crypto/bcrypt"
)

const (
	refreshTokenTTL = 30 * 24 * time.Hour
	resetTokenTTL   = 30 * time.Minute
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

	refreshToken, err := config.GenerateOpaqueToken()
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{Success: false, Message: "Gagal membuat refresh token"})
		return
	}
	_, err = h.DB.Exec(`
		INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
		VALUES ($1, $2, $3)
	`, user.ID, config.HashToken(refreshToken), time.Now().Add(refreshTokenTTL))
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{Success: false, Message: "Gagal menyimpan refresh token"})
		return
	}

	c.Set("user_id", user.ID)
	c.Set("email", user.Email)
	config.LogAudit(h.DB, c, "LOGIN", "auth", user.ID, fmt.Sprintf("%s login berhasil", user.Email))

	c.JSON(http.StatusOK, models.APIResponse{
		Success: true,
		Message: "Login berhasil",
		Data: gin.H{
			"token":         token,
			"refresh_token": refreshToken,
			"user":          user,
		},
	})
}

// ForgotPassword generates a reset token for the given email. It always
// returns a generic success message to avoid leaking which emails exist.
// No SMTP is configured in this environment, so the reset link is logged
// server-side (and echoed back in the response) instead of emailed —
// mirroring how MQTT/Midtrans degrade to a logged/simulated mode here.
func (h *AuthHandler) ForgotPassword(c *gin.Context) {
	var req models.ForgotPasswordRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, models.APIResponse{Success: false, Message: err.Error()})
		return
	}

	genericResp := models.APIResponse{
		Success: true,
		Message: "Jika email terdaftar, link reset password telah dikirim",
	}

	var userID string
	err := h.DB.QueryRow(`SELECT id FROM users WHERE email = $1 AND is_active = true`, req.Email).Scan(&userID)
	if err != nil {
		// Don't reveal whether the email exists
		c.JSON(http.StatusOK, genericResp)
		return
	}

	resetToken, err := config.GenerateOpaqueToken()
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{Success: false, Message: "Gagal membuat token reset"})
		return
	}
	_, err = h.DB.Exec(`
		INSERT INTO password_resets (user_id, token_hash, expires_at)
		VALUES ($1, $2, $3)
	`, userID, config.HashToken(resetToken), time.Now().Add(resetTokenTTL))
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{Success: false, Message: "Gagal menyimpan token reset"})
		return
	}

	resetLink := fmt.Sprintf("http://localhost:5173/reset-password?token=%s", resetToken)
	log.Printf("[EMAIL-SIM] Password reset requested for %s: %s (berlaku 30 menit)", req.Email, resetLink)

	config.LogAudit(h.DB, c, "FORGOT_PASSWORD", "auth", userID, fmt.Sprintf("Reset password diminta untuk %s", req.Email))

	genericResp.Data = gin.H{
		"simulated":       true,
		"note":            "SMTP belum dikonfigurasi — link ini disimulasikan (dilog di server), bukan dikirim via email sungguhan",
		"dev_reset_link":  resetLink,
		"dev_reset_token": resetToken,
	}
	c.JSON(http.StatusOK, genericResp)
}

// ResetPassword completes a reset using the token issued by ForgotPassword
func (h *AuthHandler) ResetPassword(c *gin.Context) {
	var req models.ResetPasswordRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, models.APIResponse{Success: false, Message: err.Error()})
		return
	}

	var resetID, userID string
	err := h.DB.QueryRow(`
		SELECT id, user_id FROM password_resets
		WHERE token_hash = $1 AND used_at IS NULL AND expires_at > NOW()
	`, config.HashToken(req.Token)).Scan(&resetID, &userID)
	if err == sql.ErrNoRows {
		c.JSON(http.StatusBadRequest, models.APIResponse{Success: false, Message: "Token reset tidak valid atau sudah kedaluwarsa"})
		return
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{Success: false, Message: "Database error"})
		return
	}

	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.NewPassword), bcrypt.DefaultCost)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{Success: false, Message: "Gagal memproses password"})
		return
	}

	tx, err := h.DB.Begin()
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{Success: false, Message: "Database error"})
		return
	}
	defer tx.Rollback()

	if _, err := tx.Exec(`UPDATE users SET password = $1, updated_at = NOW() WHERE id = $2`, string(hashedPassword), userID); err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{Success: false, Message: "Gagal update password"})
		return
	}
	if _, err := tx.Exec(`UPDATE password_resets SET used_at = NOW() WHERE id = $1`, resetID); err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{Success: false, Message: "Gagal update token"})
		return
	}
	// Revoke all refresh tokens so existing sessions can't outlive the password change
	tx.Exec(`UPDATE refresh_tokens SET revoked_at = NOW() WHERE user_id = $1 AND revoked_at IS NULL`, userID)

	if err := tx.Commit(); err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{Success: false, Message: "Gagal menyimpan perubahan"})
		return
	}

	config.LogAudit(h.DB, c, "RESET_PASSWORD", "auth", userID, "Password berhasil direset")

	c.JSON(http.StatusOK, models.APIResponse{Success: true, Message: "Password berhasil direset, silakan login dengan password baru"})
}

// RefreshToken exchanges a valid refresh token for a new access token,
// rotating the refresh token in the process.
func (h *AuthHandler) RefreshToken(c *gin.Context) {
	var req models.RefreshTokenRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, models.APIResponse{Success: false, Message: err.Error()})
		return
	}

	var tokenID, userID string
	err := h.DB.QueryRow(`
		SELECT id, user_id FROM refresh_tokens
		WHERE token_hash = $1 AND revoked_at IS NULL AND expires_at > NOW()
	`, config.HashToken(req.RefreshToken)).Scan(&tokenID, &userID)
	if err == sql.ErrNoRows {
		c.JSON(http.StatusUnauthorized, models.APIResponse{Success: false, Message: "Refresh token tidak valid atau sudah kedaluwarsa"})
		return
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{Success: false, Message: "Database error"})
		return
	}

	var user models.User
	err = h.DB.QueryRow(`
		SELECT u.id, u.name, u.email, r.name AS role_name, u.location_id,
		       COALESCE(l.code, '') AS location_code, u.is_active
		FROM users u
		JOIN roles r ON r.id = u.role_id
		LEFT JOIN locations l ON l.id = u.location_id
		WHERE u.id = $1
	`, userID).Scan(&user.ID, &user.Name, &user.Email, &user.RoleName, &user.LocationID, &user.LocationCode, &user.IsActive)
	if err != nil || !user.IsActive {
		c.JSON(http.StatusUnauthorized, models.APIResponse{Success: false, Message: "Akun tidak ditemukan atau tidak aktif"})
		return
	}

	newAccessToken, err := config.GenerateToken(user.ID, user.Email, user.RoleName, user.LocationID, user.LocationCode)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{Success: false, Message: "Gagal membuat token"})
		return
	}

	newRefreshToken, err := config.GenerateOpaqueToken()
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{Success: false, Message: "Gagal membuat refresh token"})
		return
	}

	tx, err := h.DB.Begin()
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{Success: false, Message: "Database error"})
		return
	}
	defer tx.Rollback()

	tx.Exec(`UPDATE refresh_tokens SET revoked_at = NOW() WHERE id = $1`, tokenID)
	_, err = tx.Exec(`
		INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)
	`, user.ID, config.HashToken(newRefreshToken), time.Now().Add(refreshTokenTTL))
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{Success: false, Message: "Gagal menyimpan refresh token"})
		return
	}
	if err := tx.Commit(); err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{Success: false, Message: "Gagal menyimpan perubahan"})
		return
	}

	c.JSON(http.StatusOK, models.APIResponse{
		Success: true,
		Message: "Token diperbarui",
		Data: gin.H{
			"token":         newAccessToken,
			"refresh_token": newRefreshToken,
		},
	})
}

// Logout revokes the given refresh token so it can no longer be used to
// mint new access tokens. The (already-issued) access token simply expires
// naturally on its own — this app has no access-token blacklist.
func (h *AuthHandler) Logout(c *gin.Context) {
	var req models.RefreshTokenRequest
	_ = c.ShouldBindJSON(&req) // refresh_token is best-effort; logout succeeds either way

	if req.RefreshToken != "" {
		h.DB.Exec(`UPDATE refresh_tokens SET revoked_at = NOW() WHERE token_hash = $1`, config.HashToken(req.RefreshToken))
	}

	userID := c.GetString("user_id")
	config.LogAudit(h.DB, c, "LOGOUT", "auth", userID, "User logout")

	c.JSON(http.StatusOK, models.APIResponse{Success: true, Message: "Logout berhasil"})
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
