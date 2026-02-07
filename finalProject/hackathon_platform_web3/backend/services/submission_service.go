package services

import (
	"errors"

	"hackathon-backend/database"
	"hackathon-backend/models"
)

type SubmissionService struct{}

// CreateSubmission 提交作品
func (s *SubmissionService) CreateSubmission(hackathonID, teamID uint64, submission *models.Submission) error {
	// 检查活动状态
	var hackathon models.Hackathon
	if err := database.DB.Where("id = ? AND deleted_at IS NULL", hackathonID).First(&hackathon).Error; err != nil {
		return errors.New("活动不存在")
	}

	if hackathon.Status != "submission" {
		return errors.New("当前不在提交阶段")
	}

	// 检查阶段时间
	hackathonService := &HackathonService{}
	inTime, err := hackathonService.CheckStageTime(hackathonID, "submission")
	if err != nil {
		return errors.New("提交阶段时间未设置")
	}
	if !inTime {
		return errors.New("不在提交时间范围内")
	}

	// 检查队伍是否存在
	var team models.Team
	if err := database.DB.Where("id = ? AND hackathon_id = ? AND deleted_at IS NULL", teamID, hackathonID).First(&team).Error; err != nil {
		return errors.New("队伍不存在")
	}

	// 检查是否已有提交
	var existing models.Submission
	if err := database.DB.Where("hackathon_id = ? AND team_id = ?", hackathonID, teamID).First(&existing).Error; err == nil {
		// 更新现有提交
		submission.ID = existing.ID
		return database.DB.Model(&existing).Updates(submission).Error
	}

	// 创建新提交
	submission.HackathonID = hackathonID
	submission.TeamID = teamID

	return database.DB.Create(submission).Error
}

// GetSubmissionList 获取作品列表
func (s *SubmissionService) GetSubmissionList(hackathonID uint64, page, pageSize int, keyword, sort string) ([]models.Submission, int64, error) {
	var submissions []models.Submission
	var total int64

	query := database.DB.Model(&models.Submission{}).Where("hackathon_id = ? AND draft = 0", hackathonID)

	if keyword != "" {
		query = query.Where("name LIKE ?", "%"+keyword+"%")
	}

	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	// 排序
	if sort == "created_at_asc" {
		query = query.Order("created_at ASC")
	} else {
		query = query.Order("created_at DESC")
	}

	offset := (page - 1) * pageSize
	if err := query.Preload("Team").Preload("Team.Members").Preload("Team.Members.Participant").
		Offset(offset).Limit(pageSize).Find(&submissions).Error; err != nil {
		return nil, 0, err
	}

	return submissions, total, nil
}

// GetSubmissionByID 根据ID获取作品详情
func (s *SubmissionService) GetSubmissionByID(submissionID uint64) (*models.Submission, error) {
	var submission models.Submission
	if err := database.DB.Preload("Team").Preload("Team.Members").Preload("Team.Members.Participant").
		Where("id = ?", submissionID).First(&submission).Error; err != nil {
		return nil, err
	}

	return &submission, nil
}

// UpdateSubmission 更新作品（提交阶段内）
func (s *SubmissionService) UpdateSubmission(submissionID, teamID, participantID uint64, submission *models.Submission) error {
	// 检查作品是否存在
	var existing models.Submission
	if err := database.DB.Where("id = ? AND team_id = ?", submissionID, teamID).First(&existing).Error; err != nil {
		return errors.New("作品不存在")
	}

	// 检查活动状态
	var hackathon models.Hackathon
	if err := database.DB.Where("id = ? AND deleted_at IS NULL", existing.HackathonID).First(&hackathon).Error; err != nil {
		return errors.New("活动不存在")
	}

	if hackathon.Status != "submission" {
		return errors.New("提交阶段已结束，无法修改")
	}

	// 检查阶段时间
	hackathonService := &HackathonService{}
	inTime, err := hackathonService.CheckStageTime(existing.HackathonID, "submission")
	if err != nil {
		return errors.New("提交阶段时间未设置")
	}
	if !inTime {
		return errors.New("不在提交时间范围内")
	}

	// 保存修改记录
	history := models.SubmissionHistory{
		SubmissionID:  submissionID,
		ParticipantID: participantID,
		Name:          existing.Name,
		Description:   existing.Description,
		Link:          existing.Link,
	}
	if err := database.DB.Create(&history).Error; err != nil {
		return errors.New("保存修改记录失败: " + err.Error())
	}

	// 更新作品
	return database.DB.Model(&existing).Updates(submission).Error
}

// GetSubmissionHistory 获取作品修改记录
func (s *SubmissionService) GetSubmissionHistory(submissionID uint64) ([]models.SubmissionHistory, error) {
	var histories []models.SubmissionHistory
	if err := database.DB.Where("submission_id = ?", submissionID).
		Preload("Participant").
		Order("created_at DESC").
		Find(&histories).Error; err != nil {
		return nil, err
	}
	return histories, nil
}

