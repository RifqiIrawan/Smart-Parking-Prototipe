package handlers

import (
	"bytes"
	"database/sql"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"math/rand"
	"net/http"
	"os"
	"time"

	"github.com/RifqiIrawan/smart-parking/backend/config"
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

// ─────────────────────────────────────────────
// Midtrans Core API - QRIS Charge
// ─────────────────────────────────────────────

type MidtransChargeRequest struct {
	PaymentType        string                 `json:"payment_type"`
	TransactionDetails map[string]interface{} `json:"transaction_details"`
	QRIS               map[string]interface{} `json:"qris,omitempty"`
	BankTransfer       map[string]interface{} `json:"bank_transfer,omitempty"`
	Gopay              map[string]interface{} `json:"gopay,omitempty"`
	ShopeePay          map[string]interface{} `json:"shopeepay,omitempty"`
	CustomerDetails    map[string]interface{} `json:"customer_details,omitempty"`
	ItemDetails        []map[string]interface{} `json:"item_details,omitempty"`
}

type MidtransChargeResponse struct {
	StatusCode        string                   `json:"status_code"`
	StatusMessage     string                   `json:"status_message"`
	TransactionID     string                   `json:"transaction_id"`
	OrderID           string                   `json:"order_id"`
	GrossAmount       string                   `json:"gross_amount"`
	PaymentType       string                   `json:"payment_type"`
	TransactionTime   string                   `json:"transaction_time"`
	TransactionStatus string                   `json:"transaction_status"`
	QRString          string                   `json:"qr_string"`
	Actions           []map[string]interface{} `json:"actions"`
	VANumbers         []map[string]interface{} `json:"va_numbers"`
	BillKey           string                   `json:"bill_key"`
	BillerCode        string                   `json:"biller_code"`
	PermataVANumber   string                   `json:"permata_va_number"`
}

func midtransCharge(orderID string, amount int64, paymentType string, channel string) (*MidtransChargeResponse, error) {
	serverKey := os.Getenv("MIDTRANS_SERVER_KEY")
	isSandbox := os.Getenv("MIDTRANS_SANDBOX")
	if isSandbox == "" {
		isSandbox = "true"
	}

	baseURL := "https://api.sandbox.midtrans.com"
	if isSandbox == "false" {
		baseURL = "https://api.midtrans.com"
	}

	req := MidtransChargeRequest{
		PaymentType: paymentType,
		TransactionDetails: map[string]interface{}{
			"order_id":     orderID,
			"gross_amount": amount,
		},
		CustomerDetails: map[string]interface{}{
			"first_name": "Pelanggan",
			"last_name":  "Parkir",
			"email":      "pelanggan@smartparking.id",
		},
		ItemDetails: []map[string]interface{}{
			{
				"id":       "PARKING-FEE",
				"price":    amount,
				"quantity": 1,
				"name":     "Biaya Parkir",
			},
		},
	}

	switch paymentType {
	case "qris":
		req.QRIS = map[string]interface{}{"acquirer": "gopay"}
	case "bank_transfer":
		bank := channel
		if bank == "" {
			bank = "bca"
		}
		req.BankTransfer = map[string]interface{}{"bank": bank}
	case "gopay":
		req.Gopay = map[string]interface{}{"enable_callback": false}
	case "shopeepay":
		req.ShopeePay = map[string]interface{}{"callback_url": ""}
	}

	body, _ := json.Marshal(req)
	httpReq, _ := http.NewRequest("POST", baseURL+"/v2/charge", bytes.NewBuffer(body))
	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("Accept", "application/json")

	// Basic auth: base64(serverKey:)
	auth := base64.StdEncoding.EncodeToString([]byte(serverKey + ":"))
	httpReq.Header.Set("Authorization", "Basic "+auth)

	client := &http.Client{Timeout: 15 * time.Second}
	resp, err := client.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("midtrans request failed: %v", err)
	}
	defer resp.Body.Close()

	respBody, _ := io.ReadAll(resp.Body)

	var result MidtransChargeResponse
	if err := json.Unmarshal(respBody, &result); err != nil {
		return nil, fmt.Errorf("midtrans response parse error: %v (body: %s)", err, string(respBody))
	}

	if result.StatusCode != "201" && result.StatusCode != "200" {
		return nil, fmt.Errorf("midtrans error %s: %s", result.StatusCode, result.StatusMessage)
	}

	return &result, nil
}

// ─────────────────────────────────────────────
// Check Midtrans Payment Status
// ─────────────────────────────────────────────

type MidtransStatusResponse struct {
	StatusCode        string `json:"status_code"`
	TransactionStatus string `json:"transaction_status"`
	FraudStatus       string `json:"fraud_status"`
	OrderID           string `json:"order_id"`
	GrossAmount       string `json:"gross_amount"`
	PaymentType       string `json:"payment_type"`
}

func midtransCheckStatus(orderID string) (*MidtransStatusResponse, error) {
	serverKey := os.Getenv("MIDTRANS_SERVER_KEY")
	isSandbox := os.Getenv("MIDTRANS_SANDBOX")

	baseURL := "https://api.sandbox.midtrans.com"
	if isSandbox == "false" {
		baseURL = "https://api.midtrans.com"
	}

	url := fmt.Sprintf("%s/v2/%s/status", baseURL, orderID)
	httpReq, _ := http.NewRequest("GET", url, nil)

	auth := base64.StdEncoding.EncodeToString([]byte(serverKey + ":"))
	httpReq.Header.Set("Authorization", "Basic "+auth)
	httpReq.Header.Set("Accept", "application/json")

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(httpReq)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)
	var result MidtransStatusResponse
	json.Unmarshal(body, &result)
	return &result, nil
}

// ─────────────────────────────────────────────
// Handlers
// ─────────────────────────────────────────────

func (h *PaymentHandler) CreatePayment(c *gin.Context) {
	var req models.PaymentCreateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, models.APIResponse{Success: false, Message: err.Error()})
		return
	}

	// Get transaction details
	var tx models.ParkingTransaction
	err := h.DB.QueryRow(`
		SELECT id, total_amount, status FROM parking_transactions WHERE id = $1
	`, req.TransactionID).Scan(&tx.ID, &tx.TotalAmount, &tx.Status)

	if err == sql.ErrNoRows {
		c.JSON(http.StatusNotFound, models.APIResponse{Success: false, Message: "Transaksi tidak ditemukan"})
		return
	}

	// Create order ID
	orderID := generateOrderID()
	expiredAt := time.Now().Add(15 * time.Minute)

	serverKey := os.Getenv("MIDTRANS_SERVER_KEY")
	useMidtrans := serverKey != "" && serverKey != "your-midtrans-server-key-sandbox"

	paymentData := gin.H{
		"payment_id":  "",
		"order_id":    orderID,
		"amount":      tx.TotalAmount,
		"method":      req.PaymentMethod,
		"channel":     req.PaymentChannel,
		"expired_at":  expiredAt,
		"status":      "pending",
		"use_midtrans": useMidtrans,
	}

	if useMidtrans {
		// ── Real Midtrans Integration ──
		midtransPaymentType := req.PaymentMethod
		if req.PaymentMethod == "virtual_account" {
			midtransPaymentType = "bank_transfer"
		} else if req.PaymentMethod == "ewallet" {
			midtransPaymentType = req.PaymentChannel // gopay, shopeepay
			if midtransPaymentType == "" {
				midtransPaymentType = "gopay"
			}
		}

		mtResp, mtErr := midtransCharge(orderID, int64(tx.TotalAmount), midtransPaymentType, req.PaymentChannel)
		if mtErr != nil {
			// Fallback to mock if Midtrans fails
			c.JSON(http.StatusInternalServerError, models.APIResponse{
				Success: false,
				Message: "Midtrans charge failed: " + mtErr.Error(),
			})
			return
		}

		// Extract payment-specific data from Midtrans response
		switch req.PaymentMethod {
		case "qris":
			paymentData["qr_string"] = mtResp.QRString
			// Build QR image URL from Midtrans actions
			for _, action := range mtResp.Actions {
				if action["name"] == "generate-qr-code" {
					paymentData["qr_image_url"] = action["url"]
				}
			}
			paymentData["payment_instructions"] = "Scan QR Code menggunakan aplikasi GoPay, OVO, Dana, LinkAja, atau ShopeePay"

		case "virtual_account":
			if len(mtResp.VANumbers) > 0 {
				paymentData["va_number"] = mtResp.VANumbers[0]["va_number"]
				paymentData["bank"] = mtResp.VANumbers[0]["bank"]
			}
			if mtResp.BillKey != "" {
				paymentData["bill_key"] = mtResp.BillKey
				paymentData["biller_code"] = mtResp.BillerCode
			}
			if mtResp.PermataVANumber != "" {
				paymentData["va_number"] = mtResp.PermataVANumber
				paymentData["bank"] = "permata"
			}

		case "ewallet":
			for _, action := range mtResp.Actions {
				if action["name"] == "deeplink-redirect" {
					paymentData["deeplink"] = action["url"]
				}
				if action["name"] == "generate-qr-code" {
					paymentData["qr_image_url"] = action["url"]
				}
			}
			// Midtrans simulator URL
			paymentData["simulator_url"] = fmt.Sprintf(
				"https://simulator.sandbox.midtrans.com/qris/index?transaction_id=%s",
				mtResp.TransactionID,
			)
		}

		paymentData["midtrans_transaction_id"] = mtResp.TransactionID

	} else {
		// ── Mock / Simulator Mode ──
		paymentData["mode"] = "simulator"
		paymentData["notice"] = "Mode simulator aktif. Set MIDTRANS_SERVER_KEY untuk koneksi nyata."

		switch req.PaymentMethod {
		case "qris":
			// Generate valid EMV QRIS string (mock)
			paymentData["qr_string"] = fmt.Sprintf(
				"00020101021226%sID.CO.SMARTPARKING.WWW.PAYMENT%s5204573153033605405%.0f5802ID5916Smart Parking6015Jakarta Selatan62070503***6304ABCD",
				orderID, orderID, tx.TotalAmount,
			)
			paymentData["qr_image_url"] = fmt.Sprintf("https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=DEMO-PAYMENT-%s-%.0f", orderID, tx.TotalAmount)
			paymentData["payment_instructions"] = "[MODE SIMULATOR] Klik tombol 'Konfirmasi Pembayaran' untuk mensimulasikan pembayaran QRIS"

		case "virtual_account":
			paymentData["va_number"] = fmt.Sprintf("8808%010d", rand.Intn(9999999999))
			paymentData["bank"] = req.PaymentChannel
			if req.PaymentChannel == "" {
				paymentData["bank"] = "bca"
			}
			paymentData["payment_instructions"] = "[MODE SIMULATOR] Transfer ke nomor VA di atas, lalu klik 'Konfirmasi'"

		case "ewallet":
			paymentData["deeplink"] = "gopay://pay?order_id=" + orderID
			paymentData["simulator_url"] = "https://simulator.sandbox.midtrans.com/gopay/ui/index?order_id=" + orderID
			paymentData["payment_instructions"] = "[MODE SIMULATOR] Klik tombol 'Konfirmasi Pembayaran' untuk mensimulasikan"
		}
	}

	// Insert payment record to DB
	var paymentID string
	err = h.DB.QueryRow(`
		INSERT INTO payments (transaction_id, payment_method, payment_channel, amount, gateway, gateway_order_id, expired_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id
	`, req.TransactionID, req.PaymentMethod, req.PaymentChannel, tx.TotalAmount, "midtrans", orderID, expiredAt).Scan(&paymentID)

	if err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{Success: false, Message: err.Error()})
		return
	}

	paymentData["payment_id"] = paymentID

	// Log event
	logData, _ := json.Marshal(paymentData)
	h.DB.Exec(`
		INSERT INTO payment_logs (payment_id, event, payload, source)
		VALUES ($1, 'CREATED', $2, 'api')
	`, paymentID, string(logData))

	c.JSON(http.StatusCreated, models.APIResponse{
		Success: true,
		Message: "Payment created. Menunggu konfirmasi pembayaran.",
		Data:    paymentData,
	})
}

// CheckPaymentStatus polls Midtrans for payment status
func (h *PaymentHandler) CheckPaymentStatus(c *gin.Context) {
	orderID := c.Param("order_id")

	var paymentID, status string
	var amount float64
	var transactionID string
	err := h.DB.QueryRow(`
		SELECT id, transaction_id, amount, status FROM payments WHERE gateway_order_id = $1
	`, orderID).Scan(&paymentID, &transactionID, &amount, &status)

	if err == sql.ErrNoRows {
		c.JSON(http.StatusNotFound, models.APIResponse{Success: false, Message: "Payment not found"})
		return
	}

	// If already paid in our DB, return immediately
	if status == "paid" {
		c.JSON(http.StatusOK, models.APIResponse{
			Success: true,
			Data: gin.H{
				"order_id": orderID,
				"status":   "paid",
				"db_status": status,
			},
		})
		return
	}

	serverKey := os.Getenv("MIDTRANS_SERVER_KEY")
	useMidtrans := serverKey != "" && serverKey != "your-midtrans-server-key-sandbox"

	if useMidtrans {
		// Check real Midtrans status
		mtStatus, err := midtransCheckStatus(orderID)
		if err != nil {
			c.JSON(http.StatusOK, models.APIResponse{
				Success: true,
				Data: gin.H{"order_id": orderID, "status": status, "note": "could not reach midtrans"},
			})
			return
		}

		// Update local DB if paid
		if mtStatus.TransactionStatus == "settlement" || mtStatus.TransactionStatus == "capture" {
			h.markPaid(paymentID, transactionID, orderID, amount, "qris")
			c.JSON(http.StatusOK, models.APIResponse{
				Success: true,
				Data: gin.H{"order_id": orderID, "status": "paid", "midtrans_status": mtStatus.TransactionStatus},
			})
			return
		}

		c.JSON(http.StatusOK, models.APIResponse{
			Success: true,
			Data: gin.H{"order_id": orderID, "status": "pending", "midtrans_status": mtStatus.TransactionStatus},
		})
	} else {
		// Simulator mode: just return DB status
		c.JSON(http.StatusOK, models.APIResponse{
			Success: true,
			Data: gin.H{"order_id": orderID, "status": status, "mode": "simulator"},
		})
	}
}

func (h *PaymentHandler) markPaid(paymentID, transactionID, orderID string, amount float64, method string) {
	paidAt := time.Now()
	h.DB.Exec(`
		UPDATE payments SET status='paid', paid_at=$1, updated_at=NOW() WHERE id=$2
	`, paidAt, paymentID)

	h.DB.Exec(`
		INSERT INTO payment_logs (payment_id, event, payload, source)
		VALUES ($1, 'PAID', '{"confirmed":true}', 'system')
	`, paymentID)

	// Publish MQTT event
	go config.PublishPaymentPaid(orderID, amount, method)

	// Auto-open exit gate for this transaction
	go func() {
		var gateID, gateName string
		h.DB.QueryRow(`
			SELECT g.id, g.name FROM parking_transactions pt
			JOIN gates g ON g.type='exit'
			WHERE pt.id = $1 LIMIT 1
		`, transactionID).Scan(&gateID, &gateName)
		if gateID != "" {
			config.PublishGateCommand(gateID, gateName, "open")
		}
	}()
}

func (h *PaymentHandler) Callback(c *gin.Context) {
	var payload map[string]interface{}
	if err := c.ShouldBindJSON(&payload); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	orderID, _ := payload["order_id"].(string)
	transactionStatus, _ := payload["transaction_status"].(string)

	paymentStatus := "pending"
	switch transactionStatus {
	case "capture", "settlement":
		paymentStatus = "paid"
	case "deny", "cancel":
		paymentStatus = "failed"
	case "expire":
		paymentStatus = "expired"
	}

	var paymentID, transactionID string
	var amount float64
	err := h.DB.QueryRow(`
		SELECT id, transaction_id, amount FROM payments WHERE gateway_order_id = $1
	`, orderID).Scan(&paymentID, &transactionID, &amount)

	if err == nil && paymentID != "" {
		if paymentStatus == "paid" {
			h.markPaid(paymentID, transactionID, orderID, amount, "webhook")
		} else {
			paidAt := time.Now()
			h.DB.Exec(`
				UPDATE payments SET status=$1, paid_at=$2, gateway_response=$3, updated_at=NOW()
				WHERE id=$4
			`, paymentStatus, paidAt, payload, paymentID)
		}

		logData, _ := json.Marshal(payload)
		h.DB.Exec(`
			INSERT INTO payment_logs (payment_id, event, payload, source)
			VALUES ($1, $2, $3, 'webhook')
		`, paymentID, "CALLBACK_"+transactionStatus, string(logData))
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

	// Check current status
	var currentStatus string
	h.DB.QueryRow(`SELECT status FROM payments WHERE id = $1`, paymentID).Scan(&currentStatus)
	if currentStatus == "paid" {
		c.JSON(http.StatusBadRequest, models.APIResponse{Success: false, Message: "Payment sudah dikonfirmasi sebelumnya"})
		return
	}

	h.markPaid(paymentID, transactionID, orderID, amount, "qris_simulator")

	c.JSON(http.StatusOK, models.APIResponse{
		Success: true,
		Message: fmt.Sprintf("✅ Pembayaran Rp %.0f dikonfirmasi (simulator). Gate akan terbuka.", amount),
		Data: gin.H{
			"payment_id": paymentID,
			"order_id":   orderID,
			"status":     "paid",
			"paid_at":    time.Now(),
			"mqtt_topic": fmt.Sprintf("smart-parking/payment/%s/paid", orderID),
		},
	})
}
