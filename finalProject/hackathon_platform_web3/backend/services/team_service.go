package services

import (
	"errors"
	"fmt"
	"strings"
	"time"

	"hackathon-backend/database"
	"hackathon-backend/models"
)

type TeamService struct{}

// CreateTeam 创建队伍
func (s *TeamService) CreateTeam(hackathonID, leaderID uint64, name string, maxSize int) (*models.Team, error) {
	// 检查活动状态
	var hackathon models.Hackathon
	if err := database.DB.Where("id = ? AND deleted_at IS NULL", hackathonID).First(&hackathon).Error; err != nil {
		return nil, errors.New("活动不存在")
	}

	if hackathon.Status != "team_formation" {
		return nil, errors.New("当前不在组队阶段")
	}

	// 检查是否已签到
	registrationService := &RegistrationService{}
	checkedIn, _, err := registrationService.GetCheckinStatus(hackathonID, leaderID)
	if err != nil {
		return nil, err
	}
	if !checkedIn {
		return nil, errors.New("请先完成签到")
	}

	// 检查是否已在其他队伍（作为成员或队长）
	// 注意：只检查当前活动，同一个人可以在不同活动中创建或加入不同的队伍
	var existingMember models.TeamMember
	if err := database.DB.Joins("JOIN teams ON team_members.team_id = teams.id").
		Where("team_members.participant_id = ? AND teams.hackathon_id = ? AND teams.deleted_at IS NULL", leaderID, hackathonID).
		First(&existingMember).Error; err == nil {
		return nil, errors.New("您已经在其他队伍中")
	}

	// 检查队长是否已创建队伍（一个队长在一个活动中只能创建一个队伍）
	// 注意：只检查当前活动，同一个人可以在不同活动中创建不同的队伍
	var existingTeam models.Team
	if err := database.DB.Where("hackathon_id = ? AND leader_id = ? AND deleted_at IS NULL", hackathonID, leaderID).First(&existingTeam).Error; err == nil {
		return nil, errors.New("您已经创建了队伍")
	}

	// 创建队伍
	team := models.Team{
		HackathonID: hackathonID,
		Name:        name,
		LeaderID:    leaderID,
		MaxSize:     maxSize,
		Status:      "recruiting",
	}

	if err := database.DB.Create(&team).Error; err != nil {
		// 检查是否是唯一索引冲突错误
		if strings.Contains(err.Error(), "Duplicate entry") {
			// 检查是哪个唯一索引冲突
			if strings.Contains(err.Error(), "uk_hackathon_leader") {
				// 再次查询确认是否真的已创建队伍
				var checkTeam models.Team
				if checkErr := database.DB.Where("hackathon_id = ? AND leader_id = ? AND deleted_at IS NULL", hackathonID, leaderID).First(&checkTeam).Error; checkErr == nil {
					return nil, errors.New("您已经创建了队伍")
				}
				// 如果查询不到，可能是数据库同步问题，返回通用错误
				return nil, errors.New("创建队伍失败，请稍后重试")
			}
			// 如果是旧的 uk_hackathon_name 索引冲突，说明数据库迁移未完成
			if strings.Contains(err.Error(), "uk_hackathon_name") {
				return nil, errors.New("队伍名称已存在，请先执行数据库迁移脚本 migrate_team_index.go")
			}
			// 其他唯一索引冲突，尝试查询确认
			var checkTeam models.Team
			if checkErr := database.DB.Where("hackathon_id = ? AND leader_id = ? AND deleted_at IS NULL", hackathonID, leaderID).First(&checkTeam).Error; checkErr == nil {
				return nil, errors.New("您已经创建了队伍")
			}
			return nil, fmt.Errorf("创建队伍失败: %w", err)
		}
		return nil, fmt.Errorf("创建队伍失败: %w", err)
	}

	// 创建队长成员记录
	member := models.TeamMember{
		TeamID:        team.ID,
		ParticipantID: leaderID,
		Role:          "leader",
		JoinedAt:      time.Now(), // 设置加入时间为当前时间
	}

	if err := database.DB.Create(&member).Error; err != nil {
		// 如果创建成员失败，删除队伍
		database.DB.Delete(&team)
		return nil, fmt.Errorf("创建成员记录失败: %w", err)
	}

	return &team, nil
}

// GetTeamList 获取队伍列表
func (s *TeamService) GetTeamList(hackathonID uint64, page, pageSize int, keyword string) ([]models.Team, int64, error) {
	var teams []models.Team
	var total int64

	query := database.DB.Model(&models.Team{}).Where("hackathon_id = ? AND deleted_at IS NULL", hackathonID)

	if keyword != "" {
		query = query.Where("name LIKE ?", "%"+keyword+"%")
	}

	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	offset := (page - 1) * pageSize
	if err := query.Preload("Leader").Preload("Members").Preload("Members.Participant").
		Offset(offset).Limit(pageSize).Find(&teams).Error; err != nil {
		return nil, 0, err
	}

	return teams, total, nil
}

// GetTeamByID 根据ID获取队伍详情
func (s *TeamService) GetTeamByID(teamID uint64) (*models.Team, error) {
	var team models.Team
	if err := database.DB.Preload("Leader").Preload("Members").Preload("Members.Participant").
		Where("id = ? AND deleted_at IS NULL", teamID).First(&team).Error; err != nil {
		return nil, err
	}

	return &team, nil
}

// JoinTeam 加入队伍
func (s *TeamService) JoinTeam(teamID, participantID uint64) error {
	// 获取队伍信息
	var team models.Team
	if err := database.DB.Where("id = ? AND deleted_at IS NULL", teamID).First(&team).Error; err != nil {
		return errors.New("队伍不存在")
	}

	// 检查活动状态
	if team.Status != "recruiting" {
		return errors.New("队伍已锁定，无法加入")
	}

	// 检查是否已签到
	registrationService := &RegistrationService{}
	checkedIn, _, err := registrationService.GetCheckinStatus(team.HackathonID, participantID)
	if err != nil {
		return err
	}
	if !checkedIn {
		return errors.New("请先完成签到")
	}

	// 检查是否已在其他队伍
	var existingMember models.TeamMember
	if err := database.DB.Joins("JOIN teams ON team_members.team_id = teams.id").
		Where("team_members.participant_id = ? AND teams.hackathon_id = ? AND teams.deleted_at IS NULL", participantID, team.HackathonID).
		First(&existingMember).Error; err == nil {
		return errors.New("您已经在其他队伍中")
	}

	// 检查队伍是否已满
	var memberCount int64
	database.DB.Model(&models.TeamMember{}).Where("team_id = ?", teamID).Count(&memberCount)
	if int(memberCount) >= team.MaxSize {
		return errors.New("队伍已满")
	}

	// 检查是否已在队伍中
	var existing models.TeamMember
	if err := database.DB.Where("team_id = ? AND participant_id = ?", teamID, participantID).First(&existing).Error; err == nil {
		return errors.New("您已经在该队伍中")
	}

	// 创建成员记录
	member := models.TeamMember{
		TeamID:        teamID,
		ParticipantID: participantID,
		Role:          "member",
		JoinedAt:      time.Now(), // 设置加入时间为当前时间
	}

	return database.DB.Create(&member).Error
}

// LeaveTeam 退出队伍
func (s *TeamService) LeaveTeam(teamID, participantID uint64) error {
	// 获取队伍信息
	var team models.Team
	if err := database.DB.Where("id = ? AND deleted_at IS NULL", teamID).First(&team).Error; err != nil {
		return errors.New("队伍不存在")
	}

	// 检查是否是队长
	if team.LeaderID == participantID {
		return errors.New("队长不能退出，请解散队伍")
	}

	// 检查活动状态
	var hackathon models.Hackathon
	if err := database.DB.Where("id = ? AND deleted_at IS NULL", team.HackathonID).First(&hackathon).Error; err != nil {
		return errors.New("活动不存在")
	}

	if hackathon.Status != "team_formation" {
		return errors.New("组队阶段已结束，无法退出")
	}

	// 删除成员记录
	return database.DB.Where("team_id = ? AND participant_id = ?", teamID, participantID).Delete(&models.TeamMember{}).Error
}

// RemoveMember 移除成员（仅队长）
func (s *TeamService) RemoveMember(teamID, leaderID, memberID uint64) error {
	// 获取队伍信息
	var team models.Team
	if err := database.DB.Where("id = ? AND deleted_at IS NULL", teamID).First(&team).Error; err != nil {
		return errors.New("队伍不存在")
	}

	// 检查是否是队长
	if team.LeaderID != leaderID {
		return errors.New("只有队长可以移除成员")
	}

	// 不能移除自己
	if memberID == leaderID {
		return errors.New("不能移除自己")
	}

	// 检查活动状态
	var hackathon models.Hackathon
	if err := database.DB.Where("id = ? AND deleted_at IS NULL", team.HackathonID).First(&hackathon).Error; err != nil {
		return errors.New("活动不存在")
	}

	if hackathon.Status != "team_formation" {
		return errors.New("组队阶段已结束，无法移除成员")
	}

	// 删除成员记录
	return database.DB.Where("team_id = ? AND participant_id = ?", teamID, memberID).Delete(&models.TeamMember{}).Error
}

// DissolveTeam 解散队伍（仅队长）
func (s *TeamService) DissolveTeam(teamID, leaderID uint64) error {
	// 获取队伍信息
	var team models.Team
	if err := database.DB.Where("id = ? AND deleted_at IS NULL", teamID).First(&team).Error; err != nil {
		return errors.New("队伍不存在")
	}

	// 检查是否是队长
	if team.LeaderID != leaderID {
		return errors.New("只有队长可以解散队伍")
	}

	// 检查是否有其他队员（除了队长自己）
	var memberCount int64
	database.DB.Model(&models.TeamMember{}).Where("team_id = ? AND participant_id != ?", teamID, leaderID).Count(&memberCount)
	if memberCount > 0 {
		return errors.New("队伍中有其他队员，不能解散队伍")
	}

	// 检查活动状态
	var hackathon models.Hackathon
	if err := database.DB.Where("id = ? AND deleted_at IS NULL", team.HackathonID).First(&hackathon).Error; err != nil {
		return errors.New("活动不存在")
	}

	if hackathon.Status != "team_formation" {
		return errors.New("组队阶段已结束，无法解散队伍")
	}

	// 物理删除成员记录
	if err := database.DB.Unscoped().Where("team_id = ?", teamID).Delete(&models.TeamMember{}).Error; err != nil {
		return fmt.Errorf("删除成员记录失败: %w", err)
	}

	// 物理删除队伍（直接删除数据库数据）
	return database.DB.Unscoped().Delete(&team).Error
}

// GetUserTeam 获取用户在指定活动中的队伍信息
func (s *TeamService) GetUserTeam(hackathonID, participantID uint64) (*models.Team, error) {
	var team models.Team
	// 查找用户作为成员或队长的队伍
	if err := database.DB.Joins("JOIN team_members ON teams.id = team_members.team_id").
		Where("teams.hackathon_id = ? AND team_members.participant_id = ? AND teams.deleted_at IS NULL", hackathonID, participantID).
		Preload("Leader").Preload("Members").Preload("Members.Participant").
		First(&team).Error; err != nil {
		return nil, nil // 用户不在任何队伍中，返回 nil 而不是错误
	}
	return &team, nil
}

// UpdateTeam 更新队伍信息（仅队长，组队阶段内）
func (s *TeamService) UpdateTeam(teamID, leaderID uint64, updates map[string]interface{}) error {
	// 获取队伍信息
	var team models.Team
	if err := database.DB.Where("id = ? AND deleted_at IS NULL", teamID).First(&team).Error; err != nil {
		return errors.New("队伍不存在")
	}

	// 检查是否是队长
	if team.LeaderID != leaderID {
		return errors.New("只有队长可以修改队伍信息")
	}

	// 检查活动状态
	var hackathon models.Hackathon
	if err := database.DB.Where("id = ? AND deleted_at IS NULL", team.HackathonID).First(&hackathon).Error; err != nil {
		return errors.New("活动不存在")
	}

	if hackathon.Status != "team_formation" {
		return errors.New("组队阶段已结束，无法修改队伍信息")
	}

	// 如果修改名称，检查是否重复
	if name, ok := updates["name"].(string); ok {
		var existing models.Team
		if err := database.DB.Where("hackathon_id = ? AND name = ? AND id != ? AND deleted_at IS NULL", team.HackathonID, name, teamID).First(&existing).Error; err == nil {
			return errors.New("队伍名称已存在")
		}
	}

	return database.DB.Model(&models.Team{}).Where("id = ?", teamID).Updates(updates).Error
}

