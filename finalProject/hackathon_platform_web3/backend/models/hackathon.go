package models

import (
	"time"

	"gorm.io/gorm"
)

// Hackathon 活动表
type Hackathon struct {
	ID           uint64         `gorm:"primaryKey;autoIncrement" json:"id"`
	Name         string         `gorm:"type:varchar(100);not null" json:"name"`
	Description  string         `gorm:"type:text;not null" json:"description"`
	StartTime    time.Time      `gorm:"not null" json:"start_time"`
	EndTime      time.Time      `gorm:"not null" json:"end_time"`
	LocationType string         `gorm:"type:enum('online','offline','hybrid');not null" json:"location_type"`
	City         string         `gorm:"type:varchar(100)" json:"city"` // 城市
	LocationDetail string       `gorm:"type:varchar(500)" json:"location_detail"` // 具体地址
	Status       string         `gorm:"type:enum('preparation','published','registration','checkin','team_formation','submission','voting','results');default:'preparation'" json:"status"`
	OrganizerID  uint64         `gorm:"index;not null" json:"organizer_id"`
	MaxTeamSize  int            `gorm:"default:3" json:"max_team_size"`
	MaxParticipants int         `gorm:"default:0" json:"max_participants"` // 最大参与人数，0表示不限制
	ChainActivityAddress string `gorm:"type:varchar(64);index" json:"chain_activity_address"` // Solana 活动账户 PDA，上链后可查
	// ChainCheckInsAddress 签到信息上链地址（check_ins PDA），由后端根据 program_id + chain_activity_address 推导，不落库
	ChainCheckInsAddress string `gorm:"-" json:"chain_check_ins_address,omitempty"`
	// ChainVoteTallyAddress 投票信息上链地址（vote_tally PDA），由后端根据 program_id + chain_activity_address 推导，不落库
	ChainVoteTallyAddress string `gorm:"-" json:"chain_vote_tally_address,omitempty"`
	CreatedAt    time.Time      `json:"created_at"`
	UpdatedAt    time.Time      `json:"updated_at"`
	DeletedAt    gorm.DeletedAt `gorm:"index" json:"-"`

	// 关联关系
	Organizer    User            `gorm:"foreignKey:OrganizerID" json:"organizer,omitempty"`
	Stages       []HackathonStage `gorm:"foreignKey:HackathonID" json:"stages,omitempty"`
	Awards       []HackathonAward `gorm:"foreignKey:HackathonID" json:"awards,omitempty"`
}

// TableName 指定表名
func (Hackathon) TableName() string {
	return "hackathons"
}

// HackathonStage 活动阶段时间表
type HackathonStage struct {
	ID          uint64    `gorm:"primaryKey;autoIncrement" json:"id"`
	HackathonID uint64    `gorm:"uniqueIndex:uk_hackathon_stage;not null" json:"hackathon_id"`
	Stage       string    `gorm:"uniqueIndex:uk_hackathon_stage;type:enum('registration','checkin','team_formation','submission','voting');not null" json:"stage"`
	StartTime   time.Time `gorm:"not null" json:"start_time"`
	EndTime     time.Time `gorm:"not null" json:"end_time"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

// TableName 指定表名
func (HackathonStage) TableName() string {
	return "hackathon_stages"
}

// HackathonAward 活动奖项表
type HackathonAward struct {
	ID          uint64    `gorm:"primaryKey;autoIncrement" json:"id"`
	HackathonID uint64    `gorm:"index;not null" json:"hackathon_id"`
	Name        string    `gorm:"type:varchar(100);not null" json:"name"`
	Prize       string    `gorm:"type:varchar(255);not null" json:"prize"` // 奖金金额
	Quantity    int       `gorm:"default:1" json:"quantity"`
	Rank        int       `gorm:"not null" json:"rank"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`

	// 关联关系
	Prizes []HackathonPrize `gorm:"foreignKey:AwardID" json:"prizes,omitempty"`
}

// TableName 指定表名
func (HackathonAward) TableName() string {
	return "hackathon_awards"
}

// HackathonPrize 活动奖品表
type HackathonPrize struct {
	ID          uint64    `gorm:"primaryKey;autoIncrement" json:"id"`
	HackathonID uint64    `gorm:"index;not null" json:"hackathon_id"`
	AwardID     uint64    `gorm:"index;not null" json:"award_id"` // 关联奖项
	Name        string    `gorm:"type:varchar(100);not null" json:"name"`
	Description string    `gorm:"type:text" json:"description"`
	ImageURL    string    `gorm:"type:varchar(500)" json:"image_url"`
	Order       int       `gorm:"default:0" json:"order"` // 排序
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

// TableName 指定表名
func (HackathonPrize) TableName() string {
	return "hackathon_prizes"
}

