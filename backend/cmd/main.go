package main

import (
	"haven-pos/internal/database"
	"haven-pos/internal/routes"
	"log"
	"os"
)

func main() {
	database.Connect()
	r := routes.Setup()
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}
	log.Println("Server running on :" + port)
	r.Run(":" + port)
}
