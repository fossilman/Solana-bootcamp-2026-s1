package models

import (
	"time"
)

// Submission 作品提交表
type Submission struct {
	ID          uint64    `gorm:"primaryKey;autoIncrement" json:"id"`
	HackathonID uint64    `gorm:"uniqueIndex:uk_hackathon_team;not null" json:"hackathon_id"`
	TeamID      uint64    `gorm:"uniqueIndex:uk_hackathon_team;not null" json:"team_id"`
	Name        string    `gorm:"type:varchar(100);not null" json:"name"`
	Description string    `gorm:"type:text;not null" json:"description"`
	Link        string    `gorm:"type:varchar(500);not null" json:"link"`
	Draft       int       `gorm:"type:tinyint(1);default:0" json:"draft"` // 1-草稿，0-已提交
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`

	// 关联关系
	Hackathon Hackathon `gorm:"foreignKey:HackathonID" json:"hackathon,omitempty"`
	Team      Team      `gorm:"foreignKey:TeamID" json:"team,omitempty"`
}

// TableName 指定表名
func (Submission) TableName() string {
	return "submissions"
}

// Vote 投票记录表
type Vote struct {
	ID            uint64    `gorm:"primaryKey;autoIncrement" json:"id"`
	HackathonID  uint64    `gorm:"index;not null" json:"hackathon_id"`
	ParticipantID uint64    `gorm:"uniqueIndex:uk_participant_submission;not null" json:"participant_id"`
	SubmissionID  uint64    `gorm:"uniqueIndex:uk_participant_submission;not null" json:"submission_id"`
	CreatedAt     time.Time `json:"created_at"`

	// 关联关系
	Hackathon  Hackathon  `gorm:"foreignKey:HackathonID" json:"hackathon,omitempty"`
	Participant Participant `gorm:"foreignKey:ParticipantID" json:"participant,omitempty"`
	Submission  Submission  `gorm:"foreignKey:SubmissionID" json:"submission,omitempty"`
}

// TableName 指定表名
func (Vote) TableName() string {
	return "votes"
}

// SubmissionHistory 作品修改记录表
type SubmissionHistory struct {
	ID            uint64    `gorm:"primaryKey;autoIncrement" json:"id"`
	SubmissionID uint64    `gorm:"index;not null" json:"submission_id"`
	ParticipantID uint64    `gorm:"index;not null" json:"participant_id"`
	Name          string    `gorm:"type:varchar(100)" json:"name"`
	Description   string    `gorm:"type:text" json:"description"`
	Link          string    `gorm:"type:varchar(500)" json:"link"`
	CreatedAt     time.Time `json:"created_at"`

	// 关联关系
	Submission  Submission  `gorm:"foreignKey:SubmissionID" json:"submission,omitempty"`
	Participant Participant `gorm:"foreignKey:ParticipantID" json:"participant,omitempty"`
}

// TableName 指定表名
func (SubmissionHistory) TableName() string {
	return "submission_histories"
}

