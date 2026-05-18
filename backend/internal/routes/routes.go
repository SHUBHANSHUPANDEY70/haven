package routes

import (
	"haven-pos/internal/handlers"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
)

func Setup() *gin.Engine {
	r := gin.Default()
	r.Use(cors.Default())

	api := r.Group("/api")
	{
		api.GET("/menu", handlers.GetMenu)
		api.POST("/orders", handlers.CreateOrder)
		api.GET("/orders", handlers.GetOrders)
		api.GET("/dashboard", handlers.GetDashboard)
	}
	return r
}
