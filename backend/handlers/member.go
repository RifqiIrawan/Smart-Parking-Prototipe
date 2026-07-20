package handlers

import (
	"database/sql"
	"fmt"
	"net/http"
	"strings"

	"github.com/RifqiIrawan/smart-parking/backend/config"
	"github.com/RifqiIrawan/smart-parking/backend/models"
	"github.com/gin-gonic/gin"
)

type MemberHandler struct {
	DB *sql.DB
}

func NewMemberHandler(db *sql.DB) *MemberHandler {
	return &MemberHandler{DB: db}
}

func (h *MemberHandler) ListMembers(c *gin.Context) {
	rows, err := h.DB.Query(`
		SELECT id, plate_number, member_name, COALESCE(phone, ''), membership_type,
		       discount_percent, valid_from::text, valid_until::text, is_active, COALESCE(notes, ''), created_at
		FROM members ORDER BY created_at DESC
	`)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{Success: false, Message: "Gagal memuat data member"})
		return
	}
	defer rows.Close()

	var members []models.Member
	for rows.Next() {
		var m models.Member
		rows.Scan(&m.ID, &m.PlateNumber, &m.MemberName, &m.Phone, &m.MembershipType,
			&m.DiscountPercent, &m.ValidFrom, &m.ValidUntil, &m.IsActive, &m.Notes, &m.CreatedAt)
		members = append(members, m)
	}
	c.JSON(http.StatusOK, models.APIResponse{Success: true, Data: members})
}

func (h *MemberHandler) CreateMember(c *gin.Context) {
	var req models.MemberRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, models.APIResponse{Success: false, Message: "Data tidak valid", Error: err.Error()})
		return
	}

	plate := strings.ToUpper(strings.ReplaceAll(req.PlateNumber, " ", ""))
	membershipType := req.MembershipType
	if membershipType == "" {
		membershipType = "monthly"
	}

	var m models.Member
	err := h.DB.QueryRow(`
		INSERT INTO members (plate_number, member_name, phone, membership_type, discount_percent, valid_from, valid_until, is_active, notes)
		VALUES ($1, $2, $3, $4, $5, $6, $7, true, $8)
		RETURNING id, plate_number, member_name, COALESCE(phone, ''), membership_type,
		          discount_percent, valid_from::text, valid_until::text, is_active, COALESCE(notes, ''), created_at
	`, plate, req.MemberName, req.Phone, membershipType, req.DiscountPercent, req.ValidFrom, req.ValidUntil, req.Notes).Scan(
		&m.ID, &m.PlateNumber, &m.MemberName, &m.Phone, &m.MembershipType,
		&m.DiscountPercent, &m.ValidFrom, &m.ValidUntil, &m.IsActive, &m.Notes, &m.CreatedAt,
	)
	if err != nil {
		if strings.Contains(err.Error(), "duplicate key") {
			c.JSON(http.StatusConflict, models.APIResponse{Success: false, Message: "Plat nomor ini sudah terdaftar sebagai member"})
			return
		}
		c.JSON(http.StatusInternalServerError, models.APIResponse{Success: false, Message: "Gagal membuat member", Error: err.Error()})
		return
	}

	config.LogAudit(h.DB, c, "CREATE", "member", m.ID, fmt.Sprintf("Member %s (%s) didaftarkan", m.MemberName, m.PlateNumber))
	c.JSON(http.StatusCreated, models.APIResponse{Success: true, Message: "Member berhasil didaftarkan", Data: m})
}

func (h *MemberHandler) UpdateMember(c *gin.Context) {
	id := c.Param("id")
	var req models.MemberRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, models.APIResponse{Success: false, Message: "Data tidak valid", Error: err.Error()})
		return
	}

	membershipType := req.MembershipType
	if membershipType == "" {
		membershipType = "monthly"
	}

	result, err := h.DB.Exec(`
		UPDATE members
		SET member_name=$1, phone=$2, membership_type=$3, discount_percent=$4,
		    valid_from=$5, valid_until=$6, is_active=$7, notes=$8, updated_at=NOW()
		WHERE id=$9
	`, req.MemberName, req.Phone, membershipType, req.DiscountPercent, req.ValidFrom, req.ValidUntil, req.IsActive, req.Notes, id)

	if err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{Success: false, Message: "Gagal memperbarui member", Error: err.Error()})
		return
	}

	rows, _ := result.RowsAffected()
	if rows == 0 {
		c.JSON(http.StatusNotFound, models.APIResponse{Success: false, Message: "Member tidak ditemukan"})
		return
	}

	config.LogAudit(h.DB, c, "UPDATE", "member", id, fmt.Sprintf("Member %s diperbarui", req.MemberName))
	c.JSON(http.StatusOK, models.APIResponse{Success: true, Message: "Member berhasil diperbarui"})
}

func (h *MemberHandler) DeleteMember(c *gin.Context) {
	id := c.Param("id")
	result, err := h.DB.Exec(`UPDATE members SET is_active=false, updated_at=NOW() WHERE id=$1`, id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{Success: false, Message: "Gagal menonaktifkan member"})
		return
	}
	rows, _ := result.RowsAffected()
	if rows == 0 {
		c.JSON(http.StatusNotFound, models.APIResponse{Success: false, Message: "Member tidak ditemukan"})
		return
	}
	config.LogAudit(h.DB, c, "DELETE", "member", id, "Member dinonaktifkan")
	c.JSON(http.StatusOK, models.APIResponse{Success: true, Message: "Member dinonaktifkan"})
}
