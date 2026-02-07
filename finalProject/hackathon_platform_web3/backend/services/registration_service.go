package services

import (
	"errors"
	"fmt"
	"time"

	"hackathon-backend/database"
	"hackathon-backend/models"

	"gorm.io/gorm"
)

type RegistrationService struct{}

// Register 报名参加活动
func (s *RegistrationService) Register(hackathonID, participantID uint64) error {
	// 检查参赛者是否存在
	var participant models.Participant
	if err := database.DB.Where("id = ? AND deleted_at IS NULL", participantID).First(&participant).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return errors.New("参赛者不存在")
		}
		return fmt.Errorf("查询参赛者失败: %w", err)
	}

	// 检查活动状态
	var hackathon models.Hackathon
	if err := database.DB.Where("id = ? AND deleted_at IS NULL", hackathonID).First(&hackathon).Error; err != nil {
		return errors.New("活动不存在")
	}

	if hackathon.Status != "registration" {
		return errors.New("当前不在报名阶段")
	}

	// 检查阶段时间
	hackathonService := &HackathonService{}
	inTime, err := hackathonService.CheckStageTime(hackathonID, "registration")
	if err != nil {
		return errors.New("报名阶段时间未设置")
	}
	if !inTime {
		return errors.New("不在报名时间范围内")
	}

	// 检查是否已报名
	var existing models.Registration
	if err := database.DB.Where("hackathon_id = ? AND participant_id = ?", hackathonID, participantID).First(&existing).Error; err == nil {
		return errors.New("已经报名过该活动")
	}

	// 检查是否达到最大参与人数限制
	if hackathon.MaxParticipants > 0 {
		var registeredCount int64
		if err := database.DB.Model(&models.Registration{}).Where("hackathon_id = ?", hackathonID).Count(&registeredCount).Error; err != nil {
			return fmt.Errorf("查询报名人数失败: %w", err)
		}
		if registeredCount >= int64(hackathon.MaxParticipants) {
			return errors.New("活动报名人数已满")
		}
	}

	// 创建报名记录
	registration := models.Registration{
		HackathonID:   hackathonID,
		ParticipantID: participantID,
	}

	return database.DB.Create(&registration).Error
}

// GetRegistrationStatus 获取报名状态
func (s *RegistrationService) GetRegistrationStatus(hackathonID, participantID uint64) (bool, *time.Time, error) {
	var registration models.Registration
	err := database.DB.Where("hackathon_id = ? AND participant_id = ?", hackathonID, participantID).First(&registration).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return false, nil, nil
	}
	if err != nil {
		return false, nil, err
	}

	return true, &registration.CreatedAt, nil
}

// CancelRegistration 取消报名
func (s *RegistrationService) CancelRegistration(hackathonID, participantID uint64) error {
	// 检查活动状态
	var hackathon models.Hackathon
	if err := database.DB.Where("id = ? AND deleted_at IS NULL", hackathonID).First(&hackathon).Error; err != nil {
		return errors.New("活动不存在")
	}

	if hackathon.Status != "registration" {
		return errors.New("当前不在报名阶段，不能取消报名")
	}

	// 检查阶段时间
	hackathonService := &HackathonService{}
	inTime, err := hackathonService.CheckStageTime(hackathonID, "registration")
	if err != nil {
		return errors.New("报名阶段时间未设置")
	}
	if !inTime {
		return errors.New("不在报名时间范围内，不能取消报名")
	}

	// 检查是否已报名
	var registration models.Registration
	if err := database.DB.Where("hackathon_id = ? AND participant_id = ?", hackathonID, participantID).First(&registration).Error; err != nil {
		return errors.New("您尚未报名该活动")
	}

	// 检查是否已签到（已签到不能取消报名）
	var checkin models.Checkin
	if err := database.DB.Where("hackathon_id = ? AND participant_id = ?", hackathonID, participantID).First(&checkin).Error; err == nil {
		return errors.New("已签到，不能取消报名")
	}

	// 删除报名记录
	return database.DB.Delete(&registration).Error
}

// Checkin 签到
func (s *RegistrationService) Checkin(hackathonID, participantID uint64) error {
	// 检查是否已报名
	var registration models.Registration
	if err := database.DB.Where("hackathon_id = ? AND participant_id = ?", hackathonID, participantID).First(&registration).Error; err != nil {
		return errors.New("请先报名")
	}

	// 检查活动状态
	var hackathon models.Hackathon
	if err := database.DB.Where("id = ? AND deleted_at IS NULL", hackathonID).First(&hackathon).Error; err != nil {
		return errors.New("活动不存在")
	}

	if hackathon.Status != "checkin" {
		return errors.New("当前不在签到阶段")
	}

	// 检查阶段时间
	hackathonService := &HackathonService{}
	inTime, err := hackathonService.CheckStageTime(hackathonID, "checkin")
	if err != nil {
		return errors.New("签到阶段时间未设置")
	}
	if !inTime {
		return errors.New("不在签到时间范围内")
	}

	// 检查是否已签到
	var existing models.Checkin
	if err := database.DB.Where("hackathon_id = ? AND participant_id = ?", hackathonID, participantID).First(&existing).Error; err == nil {
		return errors.New("已经签到")
	}

	// 创建签到记录
	checkin := models.Checkin{
		HackathonID:   hackathonID,
		ParticipantID: participantID,
	}

	return database.DB.Create(&checkin).Error
}

// GetCheckinStatus 获取签到状态
func (s *RegistrationService) GetCheckinStatus(hackathonID, participantID uint64) (bool, *time.Time, error) {
	var checkin models.Checkin
	err := database.DB.Where("hackathon_id = ? AND participant_id = ?", hackathonID, participantID).First(&checkin).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return false, nil, nil
	}
	if err != nil {
		return false, nil, err
	}

	return true, &checkin.CreatedAt, nil
}

