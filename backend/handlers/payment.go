package handlers

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"math/rand"
	"net/http"
	"time"

	"github.com/RifqiIrawan/smart-parking/backend/models"
	"github.com/gin-gonic/gin"
)

type PaymentHandler struct {
	DB *sql.DB
}

func NewPaymentHandler(db *sql.DB) *PaymentHandler {
	return &PaymentHandler{DB: db}
}

func generateOrderID() string {
	return fmt.Sprintf("SP-%d-%04d", time.Now().UnixMilli(), rand.Intn(9999))
}

func (h *PaymentHandler) CreatePayment(c *gin.Context) {
	var req models.PaymentCreateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, models.APIResponse{Success: false, Message: err.Error()})
		return
	}

	// Get transaction
	var tx models.ParkingTransaction
	err := h.DB.QueryRow(`
		SELECT id, total_amount, status FROM parking_transactions WHERE id = $1
	`, req.TransactionID).Scan(&tx.ID, &tx.TotalAmount, &tx.Status)

	if err == sql.ErrNoRows {
		c.JSON(http.StatusNotFound, models.APIResponse{Success: false, Message: "Transaksi tidak ditemukan"})
		return
	}

	// Create payment record
	orderID := generateOrderID()
	expiredAt := time.Now().Add(15 * time.Minute)

	var paymentID string
	err = h.DB.QueryRow(`
		INSERT INTO payments (transaction_id, payment_method, payment_channel, amount, gateway, gateway_order_id, expired_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
		RETURNING id
	`, req.TransactionID, req.PaymentMethod, req.PaymentChannel, tx.TotalAmount, "midtrans", orderID, expiredAt).Scan(&paymentID)

	if err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{Success: false, Message: err.Error()})
		return
	}

	// In production: call Midtrans/Xendit API here
	// For sandbox/demo, return mock payment data
	paymentData := gin.H{
		"payment_id":     paymentID,
		"order_id":       orderID,
		"amount":         tx.TotalAmount,
		"method":         req.PaymentMethod,
		"expired_at":     expiredAt,
		"status":         "pending",
	}

	switch req.PaymentMethod {
	case "qris":
		paymentData["qr_code"] = fmt.Sprintf("00020101021226%sID.SMARTPARKING%s5204573153033605405%.0f5802ID5925SMART PARKING SYSTEM6015JAKARTA SELATAN62070503***6304ABCD",
			orderID, orderID, tx.TotalAmount)
		paymentData["qr_url"] = "https://api.sandbox.midtrans.com/v2/qr/" + orderID
	case "virtual_account":
		paymentData["va_number"] = fmt.Sprintf("8808%010d", rand.Intn(9999999999))
		paymentData["bank"] = req.PaymentChannel
	case "ewallet":
		paymentData["deeplink"] = "https://gopay.co.id/pay/" + orderID
		paymentData["web_url"] = "https://simulator.sandbox.midtrans.com/gopay/ui/index?order_id=" + orderID
	}

	// Log payment creation
	logData, _ := json.Marshal(paymentData)
	h.DB.Exec(`
		INSERT INTO payment_logs (payment_id, event, payload, source)
		VALUES ($1, 'CREATED', $2, 'api')
	`, paymentID, string(logData))

	c.JSON(http.StatusCreated, models.APIResponse{
		Success: true,
		Message: "Payment created. Waiting for confirmation.",
		Data:    paymentData,
	})
}

func (h *PaymentHandler) Callback(c *gin.Context) {
	// Handle Midtrans/Xendit webhook callback
	var payload map[string]interface{}
	if err := c.ShouldBindJSON(&payload); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	orderID, _ := payload["order_id"].(string)
	transactionStatus, _ := payload["transaction_status"].(string)

	// Map gateway status to our status
	paymentStatus := "pending"
	switch transactionStatus {
	case "capture", "settlement":
		paymentStatus = "paid"
	case "deny", "cancel":
		paymentStatus = "failed"
	case "expire":
		paymentStatus = "expired"
	}

	var paymentID string
	err := h.DB.QueryRow(`
		SELECT id FROM payments WHERE gateway_order_id = $1
	`, orderID).Scan(&paymentID)

	if err == nil && paymentID != "" {
		paidAt := time.Now()
		h.DB.Exec(`
			UPDATE payments SET status=$1, paid_at=$2, gateway_response=$3, updated_at=NOW()
			WHERE id=$4
		`, paymentStatus, paidAt, payload, paymentID)

		// Log callback
		logData, _ := json.Marshal(payload)
		h.DB.Exec(`
			INSERT INTO payment_logs (payment_id, event, payload, source)
			VALUES ($1, $2, $3, 'webhook')
		`, paymentID, "CALLBACK_"+transactionStatus, string(logData))

		// If paid, open exit gate
		if paymentStatus == "paid" {
			// TODO: trigger gate open
		}
	}

	c.JSON(http.StatusOK, gin.H{"status": "ok"})
}

func (h *PaymentHandler) GetPayment(c *gin.Context) {
	id := c.Param("id")
	var p models.Payment
	err := h.DB.QueryRow(`
		SELECT id, transaction_id, payment_method, amount, status,
		       gateway_order_id, paid_at, expired_at, created_at
		FROM payments WHERE id = $1 OR gateway_order_id = $1
	`, id).Scan(&p.ID, &p.TransactionID, &p.PaymentMethod, &p.Amount,
		&p.Status, &p.GatewayOrderID, &p.PaidAt, &p.ExpiredAt, &p.CreatedAt)

	if err == sql.ErrNoRows {
		c.JSON(http.StatusNotFound, models.APIResponse{Success: false, Message: "Payment not found"})
		return
	}
	c.JSON(http.StatusOK, models.APIResponse{Success: true, Data: p})
}

func (h *PaymentHandler) SimulatePayment(c *gin.Context) {
	// For sandbox/demo only - simulate payment confirmation
	orderID := c.Param("order_id")

	var paymentID, transactionID string
	var amount float64
	err := h.DB.QueryRow(`
		SELECT id, transaction_id, amount FROM payments WHERE gateway_order_id = $1
	`, orderID).Scan(&paymentID, &transactionID, &amount)

	if err == sql.ErrNoRows {
		c.JSON(http.StatusNotFound, models.APIResponse{Success: false, Message: "Payment not found"})
		return
	}

	paidAt := time.Now()
	h.DB.Exec(`
		UPDATE payments SET status='paid', paid_at=$1, updated_at=NOW() WHERE id=$2
	`, paidAt, paymentID)

	h.DB.Exec(`
		INSERT INTO payment_logs (payment_id, event, payload, source)
		VALUES ($1, 'SIMULATED_PAID', '{"simulated":true}', 'simulator')
	`, paymentID)

	c.JSON(http.StatusOK, models.APIResponse{
		Success: true,
		Message: fmt.Sprintf("Payment of Rp %.0f confirmed (simulated)", amount),
		Data:    gin.H{"payment_id": paymentID, "status": "paid", "paid_at": paidAt},
	})
}
