package models

import "time"


// Location represents a parking site / branch
type Location struct {
	ID        string    `json:"id"`
	Name      string    `json:"name"`
	Code      string    `json:"code"`
	Address   string    `json:"address"`
	City      string    `json:"city"`
	Phone     string    `json:"phone"`
	Email     string    `json:"email"`
	Capacity  int       `json:"capacity"`
	IsActive  bool      `json:"is_active"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
	// Runtime stats
	ActiveSlots    int `json:"active_slots,omitempty"`
	OccupiedSlots  int `json:"occupied_slots,omitempty"`
}

// LocationRequest for create/update
type LocationRequest struct {
	Name     string `json:"name"     binding:"required"`
	Code     string `json:"code"     binding:"required"`
	Address  string `json:"address"`
	City     string `json:"city"`
	Phone    string `json:"phone"`
	Email    string `json:"email"`
	Capacity int    `json:"capacity"`
	IsActive bool   `json:"is_active"`
}

// User represents a system user
type User struct {
	ID           string    `json:"id"`
	Name         string    `json:"name"`
	Email        string    `json:"email"`
	Password     string    `json:"-"`
	RoleID       int       `json:"role_id"`
	RoleName     string    `json:"role_name,omitempty"`
	LocationID   *string   `json:"location_id"`
	LocationName string    `json:"location_name,omitempty"`
	LocationCode string    `json:"location_code,omitempty"`
	IsActive     bool      `json:"is_active"`
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`
}

// Gate represents a parking gate
type Gate struct {
	ID           string    `json:"id"`
	Name         string    `json:"name"`
	Type         string    `json:"type"`   // entry | exit
	Location     string    `json:"location"`
	Status       string    `json:"status"` // open | closed | error
	IPAddress    string    `json:"ip_address"`
	LocationID   *string   `json:"location_id"`
	LocationName string    `json:"location_name,omitempty"`
	IsActive     bool      `json:"is_active"`
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`
}

// ParkingSlot represents a parking space
type ParkingSlot struct {
	ID           string    `json:"id"`
	SlotNumber   string    `json:"slot_number"`
	Floor        string    `json:"floor"`
	Zone         string    `json:"zone"`
	Type         string    `json:"type"`   // regular | vip | handicap | motorcycle
	Status       string    `json:"status"` // available | occupied | reserved | maintenance
	LocationID   *string   `json:"location_id"`
	LocationName string    `json:"location_name,omitempty"`
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`
}

// SlotRequest for creating/updating a single parking slot
type SlotRequest struct {
	SlotNumber string `json:"slot_number" binding:"required"`
	Floor      string `json:"floor" binding:"required"`
	Zone       string `json:"zone" binding:"required"`
	Type       string `json:"type"`
	Status     string `json:"status"`
	LocationID string `json:"location_id"`
}

// BulkSlotRequest creates a whole floor's worth of slots at once — the
// practical way to "add a floor" since floors aren't a standalone entity,
// just a shared `floor` value on a group of slots.
type BulkSlotRequest struct {
	Floor      string `json:"floor" binding:"required"`
	Zone       string `json:"zone" binding:"required"`
	Type       string `json:"type"`
	Count      int    `json:"count" binding:"required,gt=0,lte=200"`
	Prefix     string `json:"prefix"`
	LocationID string `json:"location_id"`
}

// Vehicle represents a registered vehicle
type Vehicle struct {
	ID          string    `json:"id"`
	PlateNumber string    `json:"plate_number"`
	Type        string    `json:"type"` // car | motorcycle | truck
	Brand       string    `json:"brand"`
	Color       string    `json:"color"`
	OwnerName   string    `json:"owner_name"`
	OwnerPhone  string    `json:"owner_phone"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

// ParkingTransaction represents a parking session
type ParkingTransaction struct {
	ID              string     `json:"id"`
	TicketNumber    string     `json:"ticket_number"`
	VehicleID       *string    `json:"vehicle_id"`
	SlotID          *string    `json:"slot_id"`
	EntryGateID     *string    `json:"entry_gate_id"`
	ExitGateID      *string    `json:"exit_gate_id"`
	EntryTime       time.Time  `json:"entry_time"`
	ExitTime        *time.Time `json:"exit_time"`
	DurationMinutes *int       `json:"duration_minutes"`
	PlateNumber     string     `json:"plate_number"`
	PlateImageIn    string     `json:"plate_image_in"`
	PlateImageOut   string     `json:"plate_image_out"`
	BaseRate        float64    `json:"base_rate"`
	TotalAmount     float64    `json:"total_amount"`
	Status          string     `json:"status"` // active | completed | cancelled
	OperatorID      *string    `json:"operator_id"`
	Notes           string     `json:"notes"`
	// Joined fields
	SlotNumber      string     `json:"slot_number,omitempty"`
	EntryGateName   string     `json:"entry_gate_name,omitempty"`
	ExitGateName    string     `json:"exit_gate_name,omitempty"`
	OperatorName    string     `json:"operator_name,omitempty"`
	LocationID      *string    `json:"location_id,omitempty"`
	CreatedAt       time.Time  `json:"created_at"`
	UpdatedAt       time.Time  `json:"updated_at"`
}

// Payment represents a payment record
type Payment struct {
	ID               string     `json:"id"`
	TransactionID    string     `json:"transaction_id"`
	PaymentMethod    string     `json:"payment_method"`
	PaymentChannel   string     `json:"payment_channel"`
	Amount           float64    `json:"amount"`
	Status           string     `json:"status"` // pending | paid | failed | expired | refunded
	Gateway          string     `json:"gateway"`
	GatewayOrderID   string     `json:"gateway_order_id"`
	GatewayPaymentID string     `json:"gateway_payment_id"`
	PaidAt           *time.Time `json:"paid_at"`
	ExpiredAt        *time.Time `json:"expired_at"`
	CreatedAt        time.Time  `json:"created_at"`
	UpdatedAt        time.Time  `json:"updated_at"`
}

// Tariff represents pricing configuration
type Tariff struct {
	ID            string    `json:"id"`
	VehicleType   string    `json:"vehicle_type"`
	FirstHourRate float64   `json:"first_hour_rate"`
	NextHourRate  float64   `json:"next_hour_rate"`
	MaxDailyRate  float64   `json:"max_daily_rate"`
	IsActive      bool      `json:"is_active"`
	CreatedAt     time.Time `json:"created_at"`
}

// TariffRequest for creating/updating a per-vehicle-category tariff
type TariffRequest struct {
	VehicleType   string  `json:"vehicle_type"`
	FirstHourRate float64 `json:"first_hour_rate" binding:"required,gt=0"`
	NextHourRate  float64 `json:"next_hour_rate" binding:"required,gt=0"`
	MaxDailyRate  float64 `json:"max_daily_rate"`
	IsActive      bool    `json:"is_active"`
}

// Member represents a subscriber/member with a parking discount
type Member struct {
	ID              string    `json:"id"`
	PlateNumber     string    `json:"plate_number"`
	MemberName      string    `json:"member_name"`
	Phone           string    `json:"phone"`
	MembershipType  string    `json:"membership_type"`
	DiscountPercent float64   `json:"discount_percent"`
	ValidFrom       string    `json:"valid_from"`
	ValidUntil      string    `json:"valid_until"`
	IsActive        bool      `json:"is_active"`
	Notes           string    `json:"notes"`
	CreatedAt       time.Time `json:"created_at"`
}

// MemberRequest for creating/updating a member/subscription record
type MemberRequest struct {
	PlateNumber     string  `json:"plate_number" binding:"required"`
	MemberName      string  `json:"member_name" binding:"required"`
	Phone           string  `json:"phone"`
	MembershipType  string  `json:"membership_type"`
	DiscountPercent float64 `json:"discount_percent" binding:"gte=0,lte=100"`
	ValidFrom       string  `json:"valid_from" binding:"required"`
	ValidUntil      string  `json:"valid_until" binding:"required"`
	IsActive        bool    `json:"is_active"`
	Notes           string  `json:"notes"`
}

// DashboardStats for the dashboard overview
type DashboardStats struct {
	TotalSlots         int     `json:"total_slots"`
	AvailableSlots     int     `json:"available_slots"`
	OccupiedSlots      int     `json:"occupied_slots"`
	ActiveTransactions int     `json:"active_transactions"`
	TodayRevenue       float64 `json:"today_revenue"`
	TodayTransactions  int     `json:"today_transactions"`
	MonthRevenue       float64 `json:"month_revenue"`
	OccupancyRate      float64 `json:"occupancy_rate"`
	LocationID         *string `json:"location_id,omitempty"`
	LocationName       string  `json:"location_name,omitempty"`
}

// LoginRequest for auth
type LoginRequest struct {
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required"`
}

// ForgotPasswordRequest starts a password reset
type ForgotPasswordRequest struct {
	Email string `json:"email" binding:"required,email"`
}

// ResetPasswordRequest completes a password reset
type ResetPasswordRequest struct {
	Token       string `json:"token" binding:"required"`
	NewPassword string `json:"new_password" binding:"required,min=6"`
}

// RefreshTokenRequest exchanges a refresh token for a new access token
type RefreshTokenRequest struct {
	RefreshToken string `json:"refresh_token" binding:"required"`
}

// AuditLog represents a recorded user action
type AuditLog struct {
	ID          string    `json:"id"`
	UserID      *string   `json:"user_id"`
	UserName    string    `json:"user_name"`
	UserEmail   string    `json:"user_email"`
	Action      string    `json:"action"`
	EntityType  string    `json:"entity_type"`
	EntityID    string    `json:"entity_id"`
	Description string    `json:"description"`
	IPAddress   string    `json:"ip_address"`
	CreatedAt   time.Time `json:"created_at"`
}

// VehicleEntryRequest for entry processing
type VehicleEntryRequest struct {
	PlateNumber string  `json:"plate_number" binding:"required"`
	VehicleType string  `json:"vehicle_type"`
	GateID      string  `json:"gate_id"`
	SlotID      string  `json:"slot_id"`
	PlateImage  string  `json:"plate_image"`
}

// VehicleExitRequest for exit processing.
// Either TicketNumber or PlateNumber must be provided — PlateNumber lookup
// enables unattended exit flows (camera/RFID) that never see a ticket number.
type VehicleExitRequest struct {
	TicketNumber string `json:"ticket_number"`
	PlateNumber  string `json:"plate_number"`
	GateID       string `json:"gate_id"`
	PlateImage   string `json:"plate_image"`
}

// GateControlRequest for gate operations
type GateControlRequest struct {
	GateID  string `json:"gate_id" binding:"required"`
	Command string `json:"command" binding:"required"` // open | close
}

// PaymentCreateRequest to initiate payment
type PaymentCreateRequest struct {
	TransactionID  string `json:"transaction_id" binding:"required"`
	PaymentMethod  string `json:"payment_method" binding:"required"`
	PaymentChannel string `json:"payment_channel"`
}

// APIResponse standard response wrapper
type APIResponse struct {
	Success bool        `json:"success"`
	Message string      `json:"message"`
	Data    interface{} `json:"data,omitempty"`
	Error   string      `json:"error,omitempty"`
}
