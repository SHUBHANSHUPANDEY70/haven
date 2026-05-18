package main

import (
	"context"
	"fmt"
	"log"
	"os"
	"time"

	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

type MenuItem struct {
	Name     string  `bson:"name"`
	Price    float64 `bson:"price"`
	Category string  `bson:"category"`
	Note     string  `bson:"note,omitempty"`
}

func main() {
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	uri := os.Getenv("MONGODB_URI")
	if uri == "" {
		uri = "mongodb://localhost:27017"
	}

	client, err := mongo.Connect(ctx, options.Client().ApplyURI(uri))
	if err != nil {
		log.Fatal(err)
	}
	defer client.Disconnect(ctx)

	db := client.Database("haven_cafe")
	db.Collection("menu").Drop(ctx)

	items := []interface{}{
		// Quick Bites | Fast Food
		MenuItem{"French Fries", 100, "Quick Bites | Fast Food", ""},
		MenuItem{"Plain Maggi", 60, "Quick Bites | Fast Food", ""},
		MenuItem{"Veg Maggi", 80, "Quick Bites | Fast Food", ""},
		MenuItem{"Regular Pasta", 80, "Quick Bites | Fast Food", ""},
		MenuItem{"Red Sauce Pasta", 100, "Quick Bites | Fast Food", ""},
		MenuItem{"White Sauce Pasta", 150, "Quick Bites | Fast Food", ""},

		// Chaat & Snacks
		MenuItem{"Aloo Chaat", 100, "Chaat & Snacks", ""},
		MenuItem{"Corn Chaat", 100, "Chaat & Snacks", ""},
		MenuItem{"Sev Puri", 70, "Chaat & Snacks", ""},
		MenuItem{"Pani Puri", 100, "Chaat & Snacks", ""},
		MenuItem{"Bhel Puri", 80, "Chaat & Snacks", ""},
		MenuItem{"Katori Chaat", 120, "Chaat & Snacks", ""},
		MenuItem{"Raj Kachori", 150, "Chaat & Snacks", ""},

		// Crispy Starters
		MenuItem{"Peanut Masala", 100, "Crispy Starters", ""},
		MenuItem{"Chana Roast", 100, "Crispy Starters", ""},
		MenuItem{"Hara Bhara Kebab", 160, "Crispy Starters", ""},
		MenuItem{"Paneer Chilli Dry", 140, "Crispy Starters", ""},
		MenuItem{"Paneer Chilli Gravy", 160, "Crispy Starters", ""},
		MenuItem{"Veg Cutlet", 150, "Crispy Starters", ""},

		// Chinese Cravings
		MenuItem{"Veg Chowmein", 120, "Chinese Cravings", ""},
		MenuItem{"Hakka Noodles", 140, "Chinese Cravings", ""},
		MenuItem{"Schezwan Noodles", 170, "Chinese Cravings", ""},
		MenuItem{"Manchurian Dry", 150, "Chinese Cravings", ""},
		MenuItem{"Manchurian Gravy", 160, "Chinese Cravings", ""},
		MenuItem{"Manchurian Noodles", 170, "Chinese Cravings", ""},
		MenuItem{"Veg Fried Rice", 100, "Chinese Cravings", ""},
		MenuItem{"Schezwan Fried Rice", 130, "Chinese Cravings", ""},
		MenuItem{"Manchurian Fried Rice", 130, "Chinese Cravings", ""},
		MenuItem{"Paneer Fried Rice", 160, "Chinese Cravings", ""},
		MenuItem{"All Mix Special", 190, "Chinese Cravings", ""},

		// Paratha Hub
		MenuItem{"Aloo Paratha", 60, "Paratha Hub", ""},
		MenuItem{"Pyaaj Paratha", 80, "Paratha Hub", ""},
		MenuItem{"Gobhi Paratha", 80, "Paratha Hub", ""},
		MenuItem{"Paneer Paratha", 100, "Paratha Hub", ""},
		MenuItem{"Mix Paratha", 120, "Paratha Hub", ""},

		// Soups
		MenuItem{"Tomato Soup", 100, "Soups", ""},
		MenuItem{"Manchow Soup", 100, "Soups", ""},
		MenuItem{"Sweet Corn Soup", 100, "Soups", ""},
		MenuItem{"Palak Soup", 100, "Soups", ""},

		// Meal Comfort
		MenuItem{"Chole Bhature", 100, "Meal Comfort", ""},
		MenuItem{"Pav Bhaji", 100, "Meal Comfort", ""},
		MenuItem{"Idli Sambhar", 60, "Meal Comfort", ""},

		// Pizza Lab
		MenuItem{"Margherita Pizza", 160, "Pizza Lab", ""},
		MenuItem{"Cheese Corn Pizza", 190, "Pizza Lab", ""},
		MenuItem{"Onion Capsicum Pizza", 180, "Pizza Lab", ""},
		MenuItem{"Cheese Burst Pizza", 250, "Pizza Lab", ""},
		MenuItem{"Bread Pizza", 120, "Pizza Lab", ""},
		MenuItem{"Mini Pizza", 140, "Pizza Lab", ""},
		MenuItem{"Loaded Fries Pizza", 220, "Pizza Lab", ""},

		// Loaded Burger
		MenuItem{"Aloo Tikki Burger", 100, "Loaded Burger", ""},
		MenuItem{"Veg Mayo Burger", 90, "Loaded Burger", ""},
		MenuItem{"Cheese Corn Burger", 140, "Loaded Burger", ""},
		MenuItem{"Crispy Veg Burger", 120, "Loaded Burger", ""},
		MenuItem{"Paneer Burger", 160, "Loaded Burger", ""},
		MenuItem{"Cheese Burger", 130, "Loaded Burger", ""},
		MenuItem{"Bread Patty Burger", 80, "Loaded Burger", ""},
		MenuItem{"Loaded Veg Burger", 180, "Loaded Burger", ""},

		// Sandwich
		MenuItem{"Veg Grilled Sandwich", 120, "Sandwich", ""},
		MenuItem{"Cheese Grilled Sandwich", 140, "Sandwich", ""},
		MenuItem{"Veg Mayo Sandwich", 100, "Sandwich", ""},
		MenuItem{"Cheese Corn Sandwich", 140, "Sandwich", ""},
		MenuItem{"Paneer Sandwich", 150, "Sandwich", ""},
		MenuItem{"Aloo Masala Sandwich", 100, "Sandwich", ""},
		MenuItem{"Butter Toast Sandwich", 60, "Sandwich", ""},
		MenuItem{"Loaded Veg Sandwich", 170, "Sandwich", ""},

		// Veg Classics
		MenuItem{"Aloo Jeera", 100, "Veg Classics", ""},
		MenuItem{"Aloo Matar", 120, "Veg Classics", ""},
		MenuItem{"Aloo Gobhi", 120, "Veg Classics", ""},
		MenuItem{"Sev Tamatar", 140, "Veg Classics", ""},
		MenuItem{"Chana Masala", 160, "Veg Classics", ""},
		MenuItem{"Mix Veg", 180, "Veg Classics", ""},
		MenuItem{"Veg Kofta", 200, "Veg Classics", ""},
		MenuItem{"Malai Kofta", 240, "Veg Classics", ""},
		MenuItem{"Mushroom Masala", 220, "Veg Classics", ""},
		MenuItem{"Mushroom Matar", 220, "Veg Classics", ""},
		MenuItem{"Veg Kolhlapuri", 180, "Veg Classics", ""},
		MenuItem{"Aloo Dum Punjabi", 140, "Veg Classics", ""},
		MenuItem{"Tamatar Masala", 100, "Veg Classics", ""},
		MenuItem{"Corn Palak", 140, "Veg Classics", ""},
		MenuItem{"Kaju Masala", 240, "Veg Classics", ""},
		MenuItem{"Kaju Curry", 240, "Veg Classics", ""},

		// Paneer Specials
		MenuItem{"Paneer Masala", 220, "Paneer Specials", ""},
		MenuItem{"Palak Paneer", 220, "Paneer Specials", ""},
		MenuItem{"Matar Paneer", 220, "Paneer Specials", ""},
		MenuItem{"Paneer Do Pyaza", 240, "Paneer Specials", ""},
		MenuItem{"Paneer Lehsuni", 240, "Paneer Specials", ""},
		MenuItem{"Paneer Bhurji Dry", 220, "Paneer Specials", ""},
		MenuItem{"Paneer Bhurji Gravy", 240, "Paneer Specials", ""},
		MenuItem{"Shahi Paneer", 260, "Paneer Specials", ""},
		MenuItem{"Paneer Lababdar", 260, "Paneer Specials", ""},
		MenuItem{"Paneer Kaju Masala", 300, "Paneer Specials", ""},
		MenuItem{"Kadhai Paneer", 260, "Paneer Specials", ""},
		MenuItem{"Paneer Handi", 260, "Paneer Specials", ""},
		MenuItem{"Paneer Butter Masala", 250, "Paneer Specials", ""},

		// Dal
		MenuItem{"Plain Dal", 100, "Dal", ""},
		MenuItem{"Jeera Dal", 120, "Dal", ""},
		MenuItem{"Dal Tadka", 160, "Dal", ""},
		MenuItem{"Dal Handi", 180, "Dal", ""},
		MenuItem{"Dal Khichdi", 140, "Dal", ""},
		MenuItem{"Butter Dal Khichdi", 160, "Dal", ""},

		// Rice & Pulao
		MenuItem{"Steam Rice", 90, "Rice & Pulao", ""},
		MenuItem{"Jeera Rice", 100, "Rice & Pulao", ""},
		MenuItem{"Masala Rice", 120, "Rice & Pulao", ""},
		MenuItem{"Matar Pulao", 120, "Rice & Pulao", ""},
		MenuItem{"Mix Veg Pulao", 140, "Rice & Pulao", ""},
		MenuItem{"Paneer Pulao", 180, "Rice & Pulao", ""},

		// Biryani
		MenuItem{"Veg Biryani", 200, "Biryani", ""},
		MenuItem{"Paneer Lazeez Biryani", 240, "Biryani", ""},
		MenuItem{"Paneer Kaju Biryani", 260, "Biryani", ""},
		MenuItem{"Mushroom Kaju Biryani", 280, "Biryani", ""},

		// Bread
		MenuItem{"Tawa Roti", 10, "Bread", ""},
		MenuItem{"Butter Tawa Roti", 15, "Bread", ""},
		MenuItem{"Plain Paratha", 15, "Bread", ""},
		MenuItem{"Puri", 15, "Bread", ""},
		MenuItem{"Laccha Paratha", 20, "Bread", ""},

		// Beverages
		MenuItem{"Black Tea", 15, "Beverages", ""},
		MenuItem{"Tea", 20, "Beverages", ""},
		MenuItem{"Green Tea", 40, "Beverages", ""},
		MenuItem{"Hot Coffee", 40, "Beverages", ""},
		MenuItem{"Cold Coffee", 100, "Beverages", ""},
		MenuItem{"Blue Curacao Mojito", 100, "Beverages", ""},
		MenuItem{"Strawberry Mojito", 110, "Beverages", ""},
		MenuItem{"Green Apple Mojito", 110, "Beverages", ""},
		MenuItem{"Kala Khatta Soda", 60, "Beverages", ""},
		MenuItem{"Masala Lemonade", 60, "Beverages", ""},
		MenuItem{"Virgin Mojito Classic", 100, "Beverages", ""},
		MenuItem{"Butter Milk (Chaas)", 40, "Beverages", ""},
		MenuItem{"Jal Jeera", 30, "Beverages", ""},
		MenuItem{"Lassi", 60, "Beverages", ""},

		// Thali
		MenuItem{"Mini Thali", 100, "Thali", ""},
		MenuItem{"Veg Thali", 120, "Thali", ""},
		MenuItem{"Special Thali", 200, "Thali", ""},
		MenuItem{"Haven Thali", 400, "Thali", ""},

		// Extras
		MenuItem{"Idli", 10, "Extras", "per piece"},
		MenuItem{"Pav", 10, "Extras", "per piece"},
		MenuItem{"Bhature", 10, "Extras", "per piece"},
		MenuItem{"Fulki", 20, "Extras", "6 pieces"},
	}

	result, err := db.Collection("menu").InsertMany(ctx, items)
	if err != nil {
		log.Fatal(err)
	}
	fmt.Printf("Seeded %d menu items successfully!\n", len(result.InsertedIDs))
}
