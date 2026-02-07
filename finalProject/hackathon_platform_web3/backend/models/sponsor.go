package models

import (
	"time"

	"gorm.io/gorm"
)

// SponsorApplication 赞助商申请表
type SponsorApplication struct {
	ID          uint64         `gorm:"primaryKey;autoIncrement" json:"id"`
	Phone       string         `gorm:"type:varchar(20);uniqueIndex;not null" json:"phone"`
	LogoURL     string         `gorm:"type:longtext;not null" json:"logo_url"` // 存储base64编码的图片
	SponsorType string         `gorm:"type:enum('long_term','event_specific');not null" json:"sponsor_type"`
	EventIDs    string         `gorm:"type:text" json:"event_ids"` // JSON数组字符串，存储活动ID列表
	AmountSol     float64        `gorm:"type:decimal(20,9);not null;default:0" json:"amount_sol"`       // 赞助金额（SOL），提交时转入金库
	WalletAddress string         `gorm:"type:varchar(64);index" json:"wallet_address"`               // 赞助商链上钱包地址（申请时签名 sponsor_apply 的地址），审核链上指令需要
	Status        string         `gorm:"type:enum('pending','approved','rejected');default:'pending'" json:"status"`
	CreatedAt   time.Time      `json:"created_at"`
	ReviewedAt  *time.Time     `json:"reviewed_at"`
	ReviewerID  *uint64        `gorm:"index" json:"reviewer_id"`
	RejectReason string        `gorm:"type:text" json:"reject_reason"` // 拒绝原因（不对外展示）
	DeletedAt   gorm.DeletedAt `gorm:"index" json:"-"`

	// 关联关系
	Reviewer User `gorm:"foreignKey:ReviewerID" json:"reviewer,omitempty"`
}

// TableName 指定表名
func (SponsorApplication) TableName() string {
	return "sponsor_applications"
}

// Sponsor 赞助商表（审核通过后自动创建）
type Sponsor struct {
	ID            uint64         `gorm:"primaryKey;autoIncrement" json:"id"`
	UserID        uint64         `gorm:"uniqueIndex;not null" json:"user_id"` // 关联到User表
	LogoURL       string         `gorm:"type:longtext;not null" json:"logo_url"` // 存储base64编码的图片
	SponsorType   string         `gorm:"type:enum('long_term','event_specific');not null" json:"sponsor_type"`
	Status        string         `gorm:"type:enum('active','inactive');default:'active'" json:"status"`
	ApplicationID uint64         `gorm:"index;not null" json:"application_id"` // 关联申请记录
	CreatedAt     time.Time      `json:"created_at"`
	UpdatedAt     time.Time      `json:"updated_at"`
	DeletedAt     gorm.DeletedAt `gorm:"index" json:"-"`

	// 关联关系
	User        User                    `gorm:"foreignKey:UserID" json:"user,omitempty"`
	Application SponsorApplication      `gorm:"foreignKey:ApplicationID" json:"application,omitempty"`
	Events      []HackathonSponsorEvent `gorm:"foreignKey:SponsorID" json:"events,omitempty"`
}

// TableName 指定表名
func (Sponsor) TableName() string {
	return "sponsors"
}

// HackathonSponsorEvent 活动赞助商关联表（活动指定赞助商）
type HackathonSponsorEvent struct {
	ID          uint64    `gorm:"primaryKey;autoIncrement" json:"id"`
	HackathonID uint64    `gorm:"uniqueIndex:uk_hackathon_sponsor;not null" json:"hackathon_id"`
	SponsorID   uint64    `gorm:"uniqueIndex:uk_hackathon_sponsor;not null" json:"sponsor_id"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`

	// 关联关系
	Hackathon Hackathon `gorm:"foreignKey:HackathonID" json:"hackathon,omitempty"`
	Sponsor   Sponsor   `gorm:"foreignKey:SponsorID" json:"sponsor,omitempty"`
}

// TableName 指定表名
func (HackathonSponsorEvent) TableName() string {
	return "hackathon_sponsor_events"
}

