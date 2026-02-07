package services

import (
	"hackathon-backend/database"
	"hackathon-backend/models"
)

type DashboardService struct{}

type DashboardData struct {
	// 系统概览
	SystemOverview struct {
		TotalHackathons    int64 `json:"total_hackathons"`
		ActiveHackathons   int64 `json:"active_hackathons"`
		TotalUsers         int64 `json:"total_users"`
		TotalOrganizers    int64 `json:"total_organizers"`
		TotalSponsors      int64 `json:"total_sponsors"`
		TotalParticipants  int64 `json:"total_participants"`
	} `json:"system_overview"`

	// 活动统计
	HackathonStats struct {
		ByStatus map[string]int64 `json:"by_status"`
		Recent   []models.Hackathon `json:"recent"`
	} `json:"hackathon_stats"`

	// 人员统计（仅Admin）
	UserStats *struct {
		TotalOrganizers int64 `json:"total_organizers"`
		TotalSponsors   int64 `json:"total_sponsors"`
	} `json:"user_stats,omitempty"`
}

// GetDashboard 获取活动概览数据
func (s *DashboardService) GetDashboard(userID uint64, role string) (*DashboardData, error) {
	var dashboard DashboardData

	// 系统概览 - 活动统计
	var totalHackathons, activeHackathons int64
	database.DB.Model(&models.Hackathon{}).Where("deleted_at IS NULL").Count(&totalHackathons)
	database.DB.Model(&models.Hackathon{}).Where("deleted_at IS NULL AND status != 'preparation' AND status != 'results'").Count(&activeHackathons)
	dashboard.SystemOverview.TotalHackathons = totalHackathons
	dashboard.SystemOverview.ActiveHackathons = activeHackathons

	// 系统概览 - 用户统计
	var totalUsers, totalOrganizers, totalSponsors int64
	database.DB.Model(&models.User{}).Where("deleted_at IS NULL").Count(&totalUsers)
	database.DB.Model(&models.User{}).Where("deleted_at IS NULL AND role = 'organizer'").Count(&totalOrganizers)
	database.DB.Model(&models.User{}).Where("deleted_at IS NULL AND role = 'sponsor'").Count(&totalSponsors)
	dashboard.SystemOverview.TotalUsers = totalUsers
	dashboard.SystemOverview.TotalOrganizers = totalOrganizers
	dashboard.SystemOverview.TotalSponsors = totalSponsors

	// 参赛者统计
	var totalParticipants int64
	database.DB.Model(&models.Participant{}).Where("deleted_at IS NULL").Count(&totalParticipants)
	dashboard.SystemOverview.TotalParticipants = totalParticipants

	// 活动状态统计
	dashboard.HackathonStats.ByStatus = make(map[string]int64)
	statuses := []string{"preparation", "published", "registration", "checkin", "team_formation", "submission", "voting", "results"}
	for _, status := range statuses {
		var count int64
		database.DB.Model(&models.Hackathon{}).Where("deleted_at IS NULL AND status = ?", status).Count(&count)
		dashboard.HackathonStats.ByStatus[status] = count
	}

	// 最近活动
	var recentHackathons []models.Hackathon
	database.DB.Where("deleted_at IS NULL").Order("created_at DESC").Limit(10).Find(&recentHackathons)
	dashboard.HackathonStats.Recent = recentHackathons

	// 人员统计（仅Admin）
	if role == "admin" {
		dashboard.UserStats = &struct {
			TotalOrganizers int64 `json:"total_organizers"`
			TotalSponsors   int64 `json:"total_sponsors"`
		}{
			TotalOrganizers: totalOrganizers,
			TotalSponsors:   totalSponsors,
		}
	}

	return &dashboard, nil
}

