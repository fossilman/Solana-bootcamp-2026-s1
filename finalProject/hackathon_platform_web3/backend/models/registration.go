package models

import (
	"time"
)

// Registration 报名记录表
type Registration struct {
	ID            uint64    `gorm:"primaryKey;autoIncrement" json:"id"`
	HackathonID   uint64    `gorm:"uniqueIndex:uk_hackathon_participant;not null" json:"hackathon_id"`
	ParticipantID uint64    `gorm:"uniqueIndex:uk_hackathon_participant;not null" json:"participant_id"`
	CreatedAt     time.Time `json:"created_at"`

	// 关联关系
	Hackathon  Hackathon  `gorm:"foreignKey:HackathonID" json:"hackathon,omitempty"`
	Participant Participant `gorm:"foreignKey:ParticipantID" json:"participant,omitempty"`
}

// TableName 指定表名
func (Registration) TableName() string {
	return "registrations"
}

// Checkin 签到记录表
type Checkin struct {
	ID            uint64    `gorm:"primaryKey;autoIncrement" json:"id"`
	HackathonID   uint64    `gorm:"uniqueIndex:uk_hackathon_participant;not null" json:"hackathon_id"`
	ParticipantID uint64    `gorm:"uniqueIndex:uk_hackathon_participant;not null" json:"participant_id"`
	CreatedAt     time.Time `json:"created_at"`

	// 关联关系
	Hackathon  Hackathon  `gorm:"foreignKey:HackathonID" json:"hackathon,omitempty"`
	Participant Participant `gorm:"foreignKey:ParticipantID" json:"participant,omitempty"`
}

// TableName 指定表名
func (Checkin) TableName() string {
	return "checkins"
}

