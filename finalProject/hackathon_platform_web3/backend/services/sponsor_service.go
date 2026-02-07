package services

import (
	"encoding/json"
	"errors"
	"fmt"
	"math/rand"
	"time"

	"hackathon-backend/database"
	"hackathon-backend/models"
	"hackathon-backend/utils"

	"gorm.io/gorm"
)

type SponsorService struct{}

// CreateApplication 创建赞助商申请
func (s *SponsorService) CreateApplication(application *models.SponsorApplication) error {
	// 检查手机号是否已申请
	var existing models.SponsorApplication
	if err := database.DB.Where("phone = ? AND deleted_at IS NULL", application.Phone).First(&existing).Error; err == nil {
		return errors.New("该手机号已提交申请，请勿重复申请")
	}

	// 如果申请状态不是pending，返回错误
	if application.Status != "pending" {
		application.Status = "pending"
	}

	return database.DB.Create(application).Error
}

// GetApplicationByID 根据 ID 查询申请
func (s *SponsorService) GetApplicationByID(id uint64) (*models.SponsorApplication, error) {
	var application models.SponsorApplication
	if err := database.DB.Where("id = ? AND deleted_at IS NULL", id).First(&application).Error; err != nil {
		return nil, err
	}
	return &application, nil
}

// GetApplicationByPhone 根据手机号查询申请
func (s *SponsorService) GetApplicationByPhone(phone string) (*models.SponsorApplication, error) {
	var application models.SponsorApplication
	if err := database.DB.Where("phone = ? AND deleted_at IS NULL", phone).Order("created_at DESC").First(&application).Error; err != nil {
		return nil, err
	}
	return &application, nil
}

// GetPendingApplications 获取待审核申请列表
func (s *SponsorService) GetPendingApplications(page, pageSize int) ([]models.SponsorApplication, int64, error) {
	var applications []models.SponsorApplication
	var total int64

	query := database.DB.Model(&models.SponsorApplication{}).
		Where("status = ? AND deleted_at IS NULL", "pending").
		Order("created_at DESC")

	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	offset := (page - 1) * pageSize
	if err := query.Offset(offset).Limit(pageSize).Find(&applications).Error; err != nil {
		return nil, 0, err
	}

	return applications, total, nil
}

// GetReviewedApplications 获取已审核申请列表
func (s *SponsorService) GetReviewedApplications(page, pageSize int, status string) ([]models.SponsorApplication, int64, error) {
	var applications []models.SponsorApplication
	var total int64

	query := database.DB.Model(&models.SponsorApplication{}).
		Where("status != ? AND deleted_at IS NULL", "pending").
		Order("reviewed_at DESC")

	if status != "" && status != "all" {
		query = query.Where("status = ?", status)
	}

	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	offset := (page - 1) * pageSize
	if err := query.Offset(offset).Limit(pageSize).Find(&applications).Error; err != nil {
		return nil, 0, err
	}

	return applications, total, nil
}

// ReviewApplication 审核申请
func (s *SponsorService) ReviewApplication(applicationID uint64, action string, reviewerID uint64, rejectReason string) error {
	var application models.SponsorApplication
	if err := database.DB.Where("id = ? AND deleted_at IS NULL", applicationID).First(&application).Error; err != nil {
		return errors.New("申请不存在")
	}

	if application.Status != "pending" {
		return errors.New("该申请已审核，无法重复审核")
	}

	now := time.Now()

	return database.DB.Transaction(func(tx *gorm.DB) error {
		// 更新申请状态
		updateData := map[string]interface{}{
			"status":      action,
			"reviewed_at": now,
			"reviewer_id": reviewerID,
		}

		if action == "rejected" && rejectReason != "" {
			updateData["reject_reason"] = rejectReason
		}

		if err := tx.Model(&application).Updates(updateData).Error; err != nil {
			return err
		}

		// 如果审核通过，创建赞助商账号
		if action == "approved" {
			// 生成随机密码（8位）
			password := generateRandomPassword(8)

			// 创建用户
			user := models.User{
				Name:     application.Phone, // 用户名使用手机号
				Phone:    application.Phone,
				Password: password, // 会在service中加密
				Role:     "sponsor",
				Status:   1,
			}

			// 加密密码
			hashedPassword, err := utils.HashPassword(password)
			if err != nil {
				return fmt.Errorf("密码加密失败: %w", err)
			}
			user.Password = hashedPassword

			if err := tx.Create(&user).Error; err != nil {
				return fmt.Errorf("创建用户失败: %w", err)
			}

			// 创建赞助商记录
			sponsor := models.Sponsor{
				UserID:        user.ID,
				LogoURL:       application.LogoURL,
				SponsorType:   application.SponsorType,
				Status:        "active",
				ApplicationID: application.ID,
			}

			if err := tx.Create(&sponsor).Error; err != nil {
				return fmt.Errorf("创建赞助商记录失败: %w", err)
			}

			// 如果是活动指定赞助，创建关联关系
			if application.SponsorType == "event_specific" && application.EventIDs != "" {
				var eventIDs []uint64
				if err := json.Unmarshal([]byte(application.EventIDs), &eventIDs); err == nil {
					for _, eventID := range eventIDs {
						// 检查活动是否存在且已发布
						var hackathon models.Hackathon
						if err := tx.Where("id = ? AND status = 'published' AND deleted_at IS NULL", eventID).First(&hackathon).Error; err == nil {
							hackathonSponsorEvent := models.HackathonSponsorEvent{
								HackathonID: eventID,
								SponsorID:   sponsor.ID,
							}
							if err := tx.Create(&hackathonSponsorEvent).Error; err != nil {
								// 忽略错误，继续处理其他活动
								continue
							}
						}
					}
				}
			}

			// TODO: 发送通知（短信或邮件）告知赞助商账号信息
			// 这里可以集成短信或邮件服务
		}

		return nil
	})
}

// GetLongTermSponsors 获取长期赞助商列表
func (s *SponsorService) GetLongTermSponsors() ([]models.Sponsor, error) {
	var sponsors []models.Sponsor
	if err := database.DB.
		Preload("User").
		Where("sponsor_type = ? AND status = 'active' AND deleted_at IS NULL", "long_term").
		Order("created_at DESC").
		Find(&sponsors).Error; err != nil {
		return nil, err
	}
	return sponsors, nil
}

// GetEventSponsors 获取活动的指定赞助商列表
func (s *SponsorService) GetEventSponsors(hackathonID uint64) ([]models.Sponsor, error) {
	var sponsors []models.Sponsor
	if err := database.DB.
		Preload("User").
		Joins("INNER JOIN hackathon_sponsor_events ON hackathon_sponsor_events.sponsor_id = sponsors.id").
		Where("hackathon_sponsor_events.hackathon_id = ? AND sponsors.status = 'active' AND sponsors.deleted_at IS NULL", hackathonID).
		Order("sponsors.created_at DESC").
		Find(&sponsors).Error; err != nil {
		return nil, err
	}
	return sponsors, nil
}

// generateRandomPassword 生成随机密码
func generateRandomPassword(length int) string {
	const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
	rand.Seed(time.Now().UnixNano())
	password := make([]byte, length)
	for i := range password {
		password[i] = charset[rand.Intn(len(charset))]
	}
	return string(password)
}

