package handlers

import (
	"context"
	"net/http"
	"time"

	"haven-pos/internal/database"
	"haven-pos/internal/models"

	"github.com/gin-gonic/gin"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo/options"
)

func GetMenu(c *gin.Context) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	cursor, err := database.MenuCollection().Find(ctx, bson.M{})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer cursor.Close(ctx)

	var items []models.MenuItem
	if err = cursor.All(ctx, &items); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, items)
}

func CreateOrder(c *gin.Context) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	var order models.Order
	if err := c.ShouldBindJSON(&order); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Get next invoice number
	var lastOrder models.Order
	opts := options.FindOne().SetSort(bson.D{{Key: "invoiceNo", Value: -1}})
	err := database.OrderCollection().FindOne(ctx, bson.M{}, opts).Decode(&lastOrder)
	if err != nil {
		order.InvoiceNo = 1
	} else {
		order.InvoiceNo = lastOrder.InvoiceNo + 1
	}

	order.ID = primitive.NewObjectID()
	order.CreatedAt = time.Now()

	_, err = database.OrderCollection().InsertOne(ctx, order)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, order)
}

func GetOrders(c *gin.Context) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	opts := options.Find().SetSort(bson.D{{Key: "createdAt", Value: -1}})
	cursor, err := database.OrderCollection().Find(ctx, bson.M{}, opts)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer cursor.Close(ctx)

	var orders []models.Order
	if err = cursor.All(ctx, &orders); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, orders)
}

func GetDashboard(c *gin.Context) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	// Today's date range
	now := time.Now()
	startOfDay := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, now.Location())
	endOfDay := startOfDay.Add(24 * time.Hour)

	filter := bson.M{"createdAt": bson.M{"$gte": startOfDay, "$lt": endOfDay}}

	cursor, err := database.OrderCollection().Find(ctx, filter)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer cursor.Close(ctx)

	var orders []models.Order
	if err = cursor.All(ctx, &orders); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	stats := models.DashboardStats{}
	itemCount := make(map[string]int)

	for _, o := range orders {
		stats.TotalRevenue += o.Total
		stats.TotalBills++
		if o.PaymentMethod == "cash" {
			stats.CashTotal += o.Total
		} else {
			stats.DigitalTotal += o.Total
		}
		for _, item := range o.Items {
			itemCount[item.Name] += item.Quantity
		}
	}

	// Top 5 items
	type kv struct {
		Key   string
		Value int
	}
	var sorted []kv
	for k, v := range itemCount {
		sorted = append(sorted, kv{k, v})
	}
	for i := 0; i < len(sorted); i++ {
		for j := i + 1; j < len(sorted); j++ {
			if sorted[j].Value > sorted[i].Value {
				sorted[i], sorted[j] = sorted[j], sorted[i]
			}
		}
	}
	limit := 5
	if len(sorted) < 5 {
		limit = len(sorted)
	}
	for i := 0; i < limit; i++ {
		stats.TopItems = append(stats.TopItems, models.TopItem{Name: sorted[i].Key, Quantity: sorted[i].Value})
	}

	c.JSON(http.StatusOK, stats)
}

func DeleteOrder(c *gin.Context) {
	idStr := c.Param("id")
	id, err := primitive.ObjectIDFromHex(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid order ID"})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	res, err := database.OrderCollection().DeleteOne(ctx, bson.M{"_id": id})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	if res.DeletedCount == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "Order not found"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Order deleted successfully"})
}

func DeleteOlderOrders(c *gin.Context) {
	cutoffStr := c.Query("cutoff")
	if cutoffStr == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "cutoff query parameter is required"})
		return
	}

	cutoffTime, err := time.Parse(time.RFC3339, cutoffStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid cutoff date format. Must be RFC3339"})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	filter := bson.M{"createdAt": bson.M{"$lt": cutoffTime}}
	res, err := database.OrderCollection().DeleteMany(ctx, filter)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message":      "Older orders deleted successfully",
		"deletedCount": res.DeletedCount,
	})
}

