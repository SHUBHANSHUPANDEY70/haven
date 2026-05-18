package models

import (
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

type MenuItem struct {
	ID       primitive.ObjectID `bson:"_id,omitempty" json:"id"`
	Name     string             `bson:"name" json:"name"`
	Price    float64            `bson:"price" json:"price"`
	Category string             `bson:"category" json:"category"`
	Note     string             `bson:"note,omitempty" json:"note,omitempty"`
}

type OrderItem struct {
	Name     string  `bson:"name" json:"name"`
	Price    float64 `bson:"price" json:"price"`
	Quantity int     `bson:"quantity" json:"quantity"`
	Total    float64 `bson:"total" json:"total"`
}

type Order struct {
	ID            primitive.ObjectID `bson:"_id,omitempty" json:"id"`
	InvoiceNo     int                `bson:"invoiceNo" json:"invoiceNo"`
	Items         []OrderItem        `bson:"items" json:"items"`
	Subtotal      float64            `bson:"subtotal" json:"subtotal"`
	Total         float64            `bson:"total" json:"total"`
	PaymentMethod string             `bson:"paymentMethod" json:"paymentMethod"`
	CreatedAt     time.Time          `bson:"createdAt" json:"createdAt"`
}

type DashboardStats struct {
	TotalRevenue  float64        `json:"totalRevenue"`
	TotalBills    int            `json:"totalBills"`
	TopItems      []TopItem      `json:"topItems"`
	CashTotal     float64        `json:"cashTotal"`
	DigitalTotal  float64        `json:"digitalTotal"`
}

type TopItem struct {
	Name     string `json:"name"`
	Quantity int    `json:"quantity"`
}
