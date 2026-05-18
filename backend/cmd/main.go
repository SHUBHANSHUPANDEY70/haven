package main

import (
	"haven-pos/internal/database"
	"haven-pos/internal/routes"
	"log"
)

func main() {
	database.Connect()
	r := routes.Setup()
	log.Println("Server running on :8080")
	r.Run(":8080")
}
