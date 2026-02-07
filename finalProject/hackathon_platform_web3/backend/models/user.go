package models

import (
	"time"

	"gorm.io/gorm"
)

// User 用户表（管理员、主办方、赞助商）
type User struct {
	ID        uint64         `gorm:"primaryKey;autoIncrement" json:"id"`
	Name      string         `gorm:"type:varchar(100);not null" json:"name"`
	Phone     string         `gorm:"type:varchar(20);uniqueIndex" json:"phone"` // 手机号，唯一但不强制（web3登录可能没有）
	Password  string         `gorm:"type:varchar(255)" json:"-"` // 不返回密码，可为空（web3登录不需要密码）
	Role      string         `gorm:"type:enum('admin','organizer','sponsor');not null" json:"role"`
	SponsorID *uint64        `gorm:"index" json:"sponsor_id"`
	Status    int            `gorm:"type:tinyint(1);default:1" json:"status"` // 1-启用，0-禁用
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`
}

// UserWallet 用户钱包地址表（一个用户可以有多个钱包地址）
type UserWallet struct {
	ID         uint64    `gorm:"primaryKey;autoIncrement" json:"id"`
	UserID     uint64    `gorm:"index;not null" json:"user_id"`
	Address    string    `gorm:"type:varchar(255);uniqueIndex;not null" json:"address"`    // 钱包地址，唯一
	WalletType string    `gorm:"type:varchar(20);default:metamask" json:"wallet_type"`    // 钱包类型：metamask | phantom
	CreatedAt  time.Time `json:"created_at"`
	UpdatedAt  time.Time `json:"updated_at"`
}

// TableName 指定表名
func (User) TableName() string {
	return "users"
}

// TableName 指定表名
func (UserWallet) TableName() string {
	return "user_wallets"
}

