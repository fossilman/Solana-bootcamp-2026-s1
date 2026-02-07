package controllers

import (
	"strconv"

	"github.com/gin-gonic/gin"
	"hackathon-backend/database"
	"hackathon-backend/models"
	"hackathon-backend/services"
	"hackathon-backend/utils"
)

type ArenaVoteController struct {
	voteService *services.VoteService
}

func NewArenaVoteController() *ArenaVoteController {
	return &ArenaVoteController{
		voteService: &services.VoteService{},
	}
}

// Vote 投票
func (c *ArenaVoteController) Vote(ctx *gin.Context) {
	submissionID, err := strconv.ParseUint(ctx.Param("id"), 10, 64)
	if err != nil {
		utils.BadRequest(ctx, "无效的作品ID")
		return
	}

	participantID, _ := ctx.Get("participant_id")

	// 获取作品信息以获取活动ID
	var submission models.Submission
	if err := database.DB.Where("id = ?", submissionID).First(&submission).Error; err != nil {
		utils.NotFound(ctx, "作品不存在")
		return
	}

	if err := c.voteService.Vote(submission.HackathonID, participantID.(uint64), submissionID); err != nil {
		utils.BadRequest(ctx, err.Error())
		return
	}

	utils.Success(ctx, nil)
}

// CancelVote 取消投票
func (c *ArenaVoteController) CancelVote(ctx *gin.Context) {
	submissionID, err := strconv.ParseUint(ctx.Param("id"), 10, 64)
	if err != nil {
		utils.BadRequest(ctx, "无效的作品ID")
		return
	}

	participantID, _ := ctx.Get("participant_id")

	if err := c.voteService.CancelVote(participantID.(uint64), submissionID); err != nil {
		utils.BadRequest(ctx, err.Error())
		return
	}

	utils.Success(ctx, nil)
}

// GetMyVotes 获取我的投票记录
func (c *ArenaVoteController) GetMyVotes(ctx *gin.Context) {
	hackathonID, err := strconv.ParseUint(ctx.Param("id"), 10, 64)
	if err != nil {
		utils.BadRequest(ctx, "无效的活动ID")
		return
	}

	participantID, _ := ctx.Get("participant_id")

	votes, err := c.voteService.GetMyVotes(hackathonID, participantID.(uint64))
	if err != nil {
		utils.InternalServerError(ctx, err.Error())
		return
	}

	utils.Success(ctx, votes)
}

// GetResults 获取比赛结果
func (c *ArenaVoteController) GetResults(ctx *gin.Context) {
	id, err := strconv.ParseUint(ctx.Param("id"), 10, 64)
	if err != nil {
		utils.BadRequest(ctx, "无效的活动ID")
		return
	}

	results, err := c.voteService.GetResults(id)
	if err != nil {
		utils.BadRequest(ctx, err.Error())
		return
	}

	// 计算统计数据
	var totalVotes, totalTeams, totalSubmissions int64
	database.DB.Model(&models.Vote{}).Where("hackathon_id = ?", id).Count(&totalVotes)
	database.DB.Model(&models.Team{}).Where("hackathon_id = ? AND deleted_at IS NULL", id).Count(&totalTeams)
	database.DB.Model(&models.Submission{}).Where("hackathon_id = ? AND draft = 0", id).Count(&totalSubmissions)

	utils.Success(ctx, gin.H{
		"rankings": results,
		"statistics": gin.H{
			"total_votes":      totalVotes,
			"total_teams":       totalTeams,
			"total_submissions": totalSubmissions,
		},
	})
}

