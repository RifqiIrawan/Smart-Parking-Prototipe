package handlers

import (
	"database/sql"
	"net/http"

	"github.com/RifqiIrawan/smart-parking/backend/models"
	"github.com/gin-gonic/gin"
)

type TariffHandler struct {
	DB *sql.DB
}

func NewTariffHandler(db *sql.DB) *TariffHandler {
	return &TariffHandler{DB: db}
}

func (h *TariffHandler) ListTariffs(c *gin.Context) {
	rows, err := h.DB.Query(`
		SELECT id, vehicle_type, first_hour_rate, next_hour_rate, COALESCE(max_daily_rate, 0), is_active, created_at
		FROM tariffs ORDER BY vehicle_type
	`)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{Success: false, Message: "Gagal memuat tarif"})
		return
	}
	defer rows.Close()

	var tariffs []models.Tariff
	for rows.Next() {
		var t models.Tariff
		rows.Scan(&t.ID, &t.VehicleType, &t.FirstHourRate, &t.NextHourRate, &t.MaxDailyRate, &t.IsActive, &t.CreatedAt)
		tariffs = append(tariffs, t)
	}
	c.JSON(http.StatusOK, models.APIResponse{Success: true, Data: tariffs})
}

func (h *TariffHandler) CreateTariff(c *gin.Context) {
	var req models.TariffRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, models.APIResponse{Success: false, Message: "Data tidak valid", Error: err.Error()})
		return
	}

	var t models.Tariff
	err := h.DB.QueryRow(`
		INSERT INTO tariffs (vehicle_type, first_hour_rate, next_hour_rate, max_daily_rate, is_active)
		VALUES ($1, $2, $3, $4, true)
		RETURNING id, vehicle_type, first_hour_rate, next_hour_rate, COALESCE(max_daily_rate, 0), is_active, created_at
	`, req.VehicleType, req.FirstHourRate, req.NextHourRate, req.MaxDailyRate).Scan(
		&t.ID, &t.VehicleType, &t.FirstHourRate, &t.NextHourRate, &t.MaxDailyRate, &t.IsActive, &t.CreatedAt,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{Success: false, Message: "Gagal membuat tarif", Error: err.Error()})
		return
	}

	c.JSON(http.StatusCreated, models.APIResponse{Success: true, Message: "Tarif berhasil dibuat", Data: t})
}

func (h *TariffHandler) UpdateTariff(c *gin.Context) {
	id := c.Param("id")
	var req models.TariffRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, models.APIResponse{Success: false, Message: "Data tidak valid", Error: err.Error()})
		return
	}

	result, err := h.DB.Exec(`
		UPDATE tariffs
		SET first_hour_rate=$1, next_hour_rate=$2, max_daily_rate=$3, is_active=$4, updated_at=NOW()
		WHERE id=$5
	`, req.FirstHourRate, req.NextHourRate, req.MaxDailyRate, req.IsActive, id)

	if err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{Success: false, Message: "Gagal memperbarui tarif", Error: err.Error()})
		return
	}

	rows, _ := result.RowsAffected()
	if rows == 0 {
		c.JSON(http.StatusNotFound, models.APIResponse{Success: false, Message: "Tarif tidak ditemukan"})
		return
	}

	c.JSON(http.StatusOK, models.APIResponse{Success: true, Message: "Tarif berhasil diperbarui"})
}
