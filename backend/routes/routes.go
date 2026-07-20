package routes

import (
	"database/sql"
	"net/http"

	"github.com/RifqiIrawan/smart-parking/backend/handlers"
	"github.com/RifqiIrawan/smart-parking/backend/middleware"
	"github.com/RifqiIrawan/smart-parking/backend/models"
	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
)

func SetupRouter(db *sql.DB) *gin.Engine {
	r := gin.New()
	r.Use(gin.Logger())
	r.Use(gin.Recovery())
	r.Use(cors.New(cors.Config{
		AllowOrigins:     []string{"http://localhost:5173", "http://localhost:3000", "*"},
		AllowMethods:     []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Authorization"},
		ExposeHeaders:    []string{"Content-Length"},
		AllowCredentials: true,
	}))

	r.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, models.APIResponse{Success: true, Message: "Smart Parking API is running"})
	})

	authH     := handlers.NewAuthHandler(db)
	dashH     := handlers.NewDashboardHandler(db)
	vehicleH  := handlers.NewVehicleHandler(db)
	gateH     := handlers.NewGateHandler(db)
	paymentH  := handlers.NewPaymentHandler(db)
	userH     := handlers.NewUserHandler(db)
	locationH := handlers.NewLocationHandler(db)
	billingH  := handlers.NewBillingHandler(db)

	// ── Public ──
	r.POST("/api/login",            authH.Login)
	r.POST("/api/payment/callback", paymentH.Callback)

	// ── Protected ──
	api := r.Group("/api")
	api.Use(middleware.AuthMiddleware())
	{
		api.GET("/me", authH.Me)

		// ── Locations: admin + super_admin full CRUD ──
		api.GET("/locations",         locationH.ListLocations)
		api.GET("/locations/stats",   middleware.RequireRole("super_admin", "admin"), locationH.GetLocationStats)
		api.GET("/locations/:id",     locationH.GetLocation)
		api.POST("/locations",        middleware.RequireRole("super_admin", "admin"), locationH.CreateLocation)
		api.PUT("/locations/:id",     middleware.RequireRole("super_admin", "admin"), locationH.UpdateLocation)
		api.DELETE("/locations/:id",  middleware.RequireRole("super_admin", "admin"), locationH.DeleteLocation)

		// ── Dashboard ──
		api.GET("/dashboard",               dashH.GetStats)
		api.GET("/dashboard/revenue-chart", dashH.GetRevenueChart)
		api.GET("/dashboard/slot-map",      dashH.GetSlotMap)

		// ── Vehicles & Transactions ──
		api.POST("/vehicle/entry",   vehicleH.Entry)
		api.POST("/vehicle/exit",    vehicleH.Exit)
		api.GET("/transactions",     vehicleH.ListTransactions)
		api.GET("/transactions/:id", vehicleH.GetTransaction)

		// ── Gates ──
		api.GET("/gates",     gateH.ListGates)
		api.GET("/gates/:id", gateH.GetGate)
		api.POST("/gates",    middleware.RequireRole("super_admin", "admin"), gateH.CreateGate)
		api.PUT("/gates/:id", middleware.RequireRole("super_admin", "admin"), gateH.UpdateGate)
		api.POST("/gate/open",  gateH.ControlGate)
		api.POST("/gate/close", gateH.ControlGate)

		// ── Payments ──
		api.POST("/payment/create",              paymentH.CreatePayment)
		api.POST("/payment/simulate/:order_id",  paymentH.SimulatePayment)
		api.GET("/payment/status/:order_id",     paymentH.CheckPaymentStatus)
		api.GET("/payment/:id",                  paymentH.GetPayment)

		// ── Users: admin + super_admin full CRUD ──
		api.GET("/users",      middleware.RequireRole("super_admin", "admin"), userH.ListUsers)
		api.POST("/users",     middleware.RequireRole("super_admin", "admin"), userH.CreateUser)
		api.PUT("/users/:id",  middleware.RequireRole("super_admin", "admin"), userH.UpdateUser)
		api.DELETE("/users/:id", middleware.RequireRole("super_admin", "admin"), userH.DeleteUser)
		api.GET("/roles",      userH.ListRoles)

		// ── Billing ──
		api.GET("/billing/check",  billingH.CheckBilling)
		api.GET("/billing/active", billingH.ListBillingActive)

		// ── Slots & Reports ──
		api.GET("/slots",   userH.GetSlots)
		api.GET("/reports", userH.GetReports)
	}

	return r
}
