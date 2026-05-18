package database

import (
	"context"
	"log"
	"time"

	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

var DB *mongo.Database

func Connect() {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	client, err := mongo.Connect(ctx, options.Client().ApplyURI("mongodb://localhost:27017"))
	if err != nil {
		log.Fatal("MongoDB connection error:", err)
	}

	if err = client.Ping(ctx, nil); err != nil {
		log.Fatal("MongoDB ping error:", err)
	}

	DB = client.Database("haven_cafe")
	log.Println("Connected to MongoDB")
}

func MenuCollection() *mongo.Collection {
	return DB.Collection("menu")
}

func OrderCollection() *mongo.Collection {
	return DB.Collection("orders")
}
