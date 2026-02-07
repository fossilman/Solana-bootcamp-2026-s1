package services

import (
	"errors"

	"hackathon-backend/database"
	"hackathon-backend/models"
)

type VoteService struct{}

// Vote 投票
func (s *VoteService) Vote(hackathonID, participantID, submissionID uint64) error {
	// 检查活动状态
	var hackathon models.Hackathon
	if err := database.DB.Where("id = ? AND deleted_at IS NULL", hackathonID).First(&hackathon).Error; err != nil {
		return errors.New("活动不存在")
	}

	if hackathon.Status != "voting" {
		return errors.New("当前不在投票阶段")
	}

	// 检查阶段时间
	hackathonService := &HackathonService{}
	inTime, err := hackathonService.CheckStageTime(hackathonID, "voting")
	if err != nil {
		return errors.New("投票阶段时间未设置")
	}
	if !inTime {
		return errors.New("不在投票时间范围内")
	}

	// 检查是否已签到
	registrationService := &RegistrationService{}
	checkedIn, _, err := registrationService.GetCheckinStatus(hackathonID, participantID)
	if err != nil {
		return err
	}
	if !checkedIn {
		return errors.New("请先完成签到")
	}

	// 检查作品是否存在
	var submission models.Submission
	if err := database.DB.Where("id = ? AND hackathon_id = ? AND draft = 0", submissionID, hackathonID).First(&submission).Error; err != nil {
		return errors.New("作品不存在")
	}

	// 检查是否已投票
	var existing models.Vote
	if err := database.DB.Where("participant_id = ? AND submission_id = ?", participantID, submissionID).First(&existing).Error; err == nil {
		return errors.New("您已经对该作品投过票了")
	}

	// 创建投票记录
	vote := models.Vote{
		HackathonID:   hackathonID,
		ParticipantID: participantID,
		SubmissionID:  submissionID,
	}

	return database.DB.Create(&vote).Error
}

// CancelVote 取消投票
func (s *VoteService) CancelVote(participantID, submissionID uint64) error {
	// 检查活动状态
	var vote models.Vote
	if err := database.DB.Where("participant_id = ? AND submission_id = ?", participantID, submissionID).First(&vote).Error; err != nil {
		return errors.New("投票记录不存在")
	}

	var hackathon models.Hackathon
	if err := database.DB.Where("id = ? AND deleted_at IS NULL", vote.HackathonID).First(&hackathon).Error; err != nil {
		return errors.New("活动不存在")
	}

	if hackathon.Status != "voting" {
		return errors.New("投票阶段已结束，无法取消投票")
	}

	// 检查阶段时间
	hackathonService := &HackathonService{}
	inTime, err := hackathonService.CheckStageTime(vote.HackathonID, "voting")
	if err != nil {
		return errors.New("投票阶段时间未设置")
	}
	if !inTime {
		return errors.New("不在投票时间范围内")
	}

	// 删除投票记录
	return database.DB.Where("participant_id = ? AND submission_id = ?", participantID, submissionID).Delete(&models.Vote{}).Error
}

// GetMyVotes 获取我的投票记录
func (s *VoteService) GetMyVotes(hackathonID, participantID uint64) ([]models.Vote, error) {
	var votes []models.Vote
	if err := database.DB.Preload("Submission").Preload("Submission.Team").
		Where("hackathon_id = ? AND participant_id = ?", hackathonID, participantID).
		Find(&votes).Error; err != nil {
		return nil, err
	}

	return votes, nil
}

// GetVoteCount 获取作品得票数
func (s *VoteService) GetVoteCount(submissionID uint64) (int64, error) {
	var count int64
	if err := database.DB.Model(&models.Vote{}).Where("submission_id = ?", submissionID).Count(&count).Error; err != nil {
		return 0, err
	}
	return count, nil
}

// GetResults 获取比赛结果
func (s *VoteService) GetResults(hackathonID uint64) ([]map[string]interface{}, error) {
	// 检查活动状态
	var hackathon models.Hackathon
	if err := database.DB.Where("id = ? AND deleted_at IS NULL", hackathonID).First(&hackathon).Error; err != nil {
		return nil, errors.New("活动不存在")
	}

	if hackathon.Status != "results" {
		return nil, errors.New("结果尚未公布")
	}

	// 获取所有提交的作品及其得票数
	var submissions []models.Submission
	if err := database.DB.Preload("Team").Preload("Team.Members").Preload("Team.Members.Participant").
		Where("hackathon_id = ? AND draft = 0", hackathonID).Find(&submissions).Error; err != nil {
		return nil, err
	}

	// 获取奖项设置
	var awards []models.HackathonAward
	if err := database.DB.Where("hackathon_id = ?", hackathonID).Order("`rank` ASC").Find(&awards).Error; err != nil {
		return nil, err
	}

	// 计算每个作品的得票数并排序
	type SubmissionWithVotes struct {
		Submission models.Submission
		VoteCount  int64
	}

	var submissionsWithVotes []SubmissionWithVotes
	for _, submission := range submissions {
		voteCount, _ := s.GetVoteCount(submission.ID)
		submissionsWithVotes = append(submissionsWithVotes, SubmissionWithVotes{
			Submission: submission,
			VoteCount:  voteCount,
		})
	}

	// 按得票数排序（降序）
	for i := 0; i < len(submissionsWithVotes)-1; i++ {
		for j := i + 1; j < len(submissionsWithVotes); j++ {
			if submissionsWithVotes[i].VoteCount < submissionsWithVotes[j].VoteCount {
				submissionsWithVotes[i], submissionsWithVotes[j] = submissionsWithVotes[j], submissionsWithVotes[i]
			}
		}
	}

	// 构建结果
	results := make([]map[string]interface{}, 0)
	for rank, item := range submissionsWithVotes {
		result := map[string]interface{}{
			"rank":       rank + 1,
			"team":       item.Submission.Team,
			"submission": item.Submission,
			"vote_count": item.VoteCount,
			"award":      nil,
		}

		// 分配奖项
		if rank < len(awards) {
			result["award"] = awards[rank]
		}

		results = append(results, result)
	}

	return results, nil
}

