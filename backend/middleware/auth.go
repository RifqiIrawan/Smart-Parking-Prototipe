package middleware

import (
	"net/http"
	"strings"

	"github.com/RifqiIrawan/smart-parking/backend/config"
	"github.com/RifqiIrawan/smart-parking/backend/models"
	"github.com/gin-gonic/gin"
)

func AuthMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			c.JSON(http.StatusUnauthorized, models.APIResponse{
				Success: false, Message: "Authorization header required",
			})
			c.Abort()
			return
		}

		parts := strings.SplitN(authHeader, " ", 2)
		if len(parts) != 2 || parts[0] != "Bearer" {
			c.JSON(http.StatusUnauthorized, models.APIResponse{
				Success: false, Message: "Invalid format. Use: Bearer <token>",
			})
			c.Abort()
			return
		}

		claims, err := config.ValidateToken(parts[1])
		if err != nil {
			c.JSON(http.StatusUnauthorized, models.APIResponse{
				Success: false, Message: "Invalid or expired token", Error: err.Error(),
			})
			c.Abort()
			return
		}

		c.Set("user_id",      claims.UserID)
		c.Set("email",        claims.Email)
		c.Set("role",         claims.Role)
		c.Set("location_id",  claims.LocationID)   // *string, nil = super_admin
		c.Set("location_code", claims.LocationCode)
		c.Next()
	}
}

// RequireRole checks that the caller has one of the given roles.
func RequireRole(roles ...string) gin.HandlerFunc {
	return func(c *gin.Context) {
		role, _ := c.Get("role")
		roleStr, _ := role.(string)

		// super_admin always passes role checks
		if roleStr == "super_admin" {
			c.Next()
			return
		}

		for _, r := range roles {
			if r == roleStr {
				c.Next()
				return
			}
		}

		c.JSON(http.StatusForbidden, models.APIResponse{
			Success: false, Message: "Akses ditolak: role tidak mencukupi",
		})
		c.Abort()
	}
}

// IsSuperAdmin returns true when the caller is super_admin OR admin.
// Both roles have full visibility across all locations.
func IsSuperAdmin(c *gin.Context) bool {
	role, _ := c.Get("role")
	r, _ := role.(string)
	return r == "super_admin" || r == "admin"
}

// GetLocationFilter returns (locationID *string, isSuperAdmin bool).
// Handlers use this to build WHERE clauses:
//
//	locID, isSuper := middleware.GetLocationFilter(c)
//	if !isSuper { query += " AND location_id = $n"; args = append(args, locID) }
func GetLocationFilter(c *gin.Context) (*string, bool) {
	if IsSuperAdmin(c) {
		// super_admin can optionally scope to a specific location via ?location_id=
		if qLoc := c.Query("location_id"); qLoc != "" {
			return &qLoc, false // treat as scoped, not super
		}
		return nil, true
	}
	locID, _ := c.Get("location_id")
	if locID == nil {
		return nil, false
	}
	s, _ := locID.(*string)
	return s, false
}
