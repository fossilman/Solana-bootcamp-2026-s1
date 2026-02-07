package models

import (
	"time"

	"gorm.io/gorm"
)

// Team 队伍表
// 唯一索引 uk_hackathon_leader (hackathon_id, leader_id) 确保：
// - 一个队长在一个活动中只能创建一个队伍
// - 同一个队长可以在不同活动中创建不同的队伍
type Team struct {
	ID          uint64         `gorm:"primaryKey;autoIncrement" json:"id"`
	HackathonID uint64         `gorm:"uniqueIndex:uk_hackathon_leader;not null" json:"hackathon_id"`
	Name        string         `gorm:"type:varchar(50);not null" json:"name"`
	LeaderID    uint64         `gorm:"uniqueIndex:uk_hackathon_leader;not null" json:"leader_id"`
	MaxSize     int            `gorm:"default:3" json:"max_size"`
	Status      string         `gorm:"type:enum('recruiting','locked');default:'recruiting'" json:"status"`
	CreatedAt   time.Time      `json:"created_at"`
	UpdatedAt   time.Time      `json:"updated_at"`
	DeletedAt   gorm.DeletedAt `gorm:"index" json:"-"`

	// 关联关系
	Hackathon  Hackathon      `gorm:"foreignKey:HackathonID" json:"hackathon,omitempty"`
	Leader     Participant    `gorm:"foreignKey:LeaderID" json:"leader,omitempty"`
	Members    []TeamMember   `gorm:"foreignKey:TeamID" json:"members,omitempty"`
}

// TableName 指定表名
func (Team) TableName() string {
	return "teams"
}

// TeamMember 队伍成员表
type TeamMember struct {
	ID            uint64    `gorm:"primaryKey;autoIncrement" json:"id"`
	TeamID        uint64    `gorm:"uniqueIndex:uk_team_participant;not null" json:"team_id"`
	ParticipantID uint64    `gorm:"uniqueIndex:uk_team_participant;not null" json:"participant_id"`
	Role          string    `gorm:"type:enum('leader','member');default:'member'" json:"role"`
	JoinedAt      time.Time `json:"joined_at"`

	// 关联关系
	Team        Team       `gorm:"foreignKey:TeamID" json:"team,omitempty"`
	Participant Participant `gorm:"foreignKey:ParticipantID" json:"participant,omitempty"`
}

// TableName 指定表名
func (TeamMember) TableName() string {
	return "team_members"
}

