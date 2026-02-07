package controllers

import (
	"strconv"

	"github.com/gin-gonic/gin"
	"hackathon-backend/database"
	"hackathon-backend/models"
	"hackathon-backend/services"
	"hackathon-backend/utils"
)

type ArenaSubmissionController struct {
	submissionService *services.SubmissionService
	teamService       *services.TeamService
}

func NewArenaSubmissionController() *ArenaSubmissionController {
	return &ArenaSubmissionController{
		submissionService: &services.SubmissionService{},
		teamService:       &services.TeamService{},
	}
}

// CreateSubmission 提交作品
func (c *ArenaSubmissionController) CreateSubmission(ctx *gin.Context) {
	hackathonID, err := strconv.ParseUint(ctx.Param("id"), 10, 64)
	if err != nil {
		utils.BadRequest(ctx, "无效的活动ID")
		return
	}

	var submission models.Submission
	if err := ctx.ShouldBindJSON(&submission); err != nil {
		utils.BadRequest(ctx, "参数错误: "+err.Error())
		return
	}

	participantID, _ := ctx.Get("participant_id")

	// 查找用户所在的队伍
	var teamMember models.TeamMember
	if err := database.DB.Joins("JOIN teams ON team_members.team_id = teams.id").
		Where("team_members.participant_id = ? AND teams.hackathon_id = ? AND teams.deleted_at IS NULL", participantID, hackathonID).
		First(&teamMember).Error; err != nil {
		utils.BadRequest(ctx, "您还没有加入队伍")
		return
	}

	// 检查是否是队长
	if teamMember.Role != "leader" {
		utils.Forbidden(ctx, "只有队长可以提交作品")
		return
	}

	if err := c.submissionService.CreateSubmission(hackathonID, teamMember.TeamID, &submission); err != nil {
		utils.BadRequest(ctx, err.Error())
		return
	}

	utils.Success(ctx, submission)
}

// GetSubmissionList 获取作品列表
func (c *ArenaSubmissionController) GetSubmissionList(ctx *gin.Context) {
	id, err := strconv.ParseUint(ctx.Param("id"), 10, 64)
	if err != nil {
		utils.BadRequest(ctx, "无效的活动ID")
		return
	}

	page, _ := strconv.Atoi(ctx.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(ctx.DefaultQuery("page_size", "10"))
	keyword := ctx.Query("keyword")
	sort := ctx.DefaultQuery("sort", "created_at_desc")

	submissions, total, err := c.submissionService.GetSubmissionList(id, page, pageSize, keyword, sort)
	if err != nil {
		utils.InternalServerError(ctx, err.Error())
		return
	}

	utils.SuccessWithPagination(ctx, submissions, page, pageSize, total)
}

// GetSubmissionByID 获取作品详情
func (c *ArenaSubmissionController) GetSubmissionByID(ctx *gin.Context) {
	id, err := strconv.ParseUint(ctx.Param("id"), 10, 64)
	if err != nil {
		utils.BadRequest(ctx, "无效的作品ID")
		return
	}

	submission, err := c.submissionService.GetSubmissionByID(id)
	if err != nil {
		utils.NotFound(ctx, "作品不存在")
		return
	}

	utils.Success(ctx, submission)
}

// UpdateSubmission 更新作品
func (c *ArenaSubmissionController) UpdateSubmission(ctx *gin.Context) {
	id, err := strconv.ParseUint(ctx.Param("id"), 10, 64)
	if err != nil {
		utils.BadRequest(ctx, "无效的作品ID")
		return
	}

	var submission models.Submission
	if err := ctx.ShouldBindJSON(&submission); err != nil {
		utils.BadRequest(ctx, "参数错误: "+err.Error())
		return
	}

	participantID, _ := ctx.Get("participant_id")

	// 查找用户所在的队伍
	var teamMember models.TeamMember
	if err := database.DB.Joins("JOIN teams ON team_members.team_id = teams.id").
		Joins("JOIN submissions ON submissions.team_id = teams.id").
		Where("team_members.participant_id = ? AND submissions.id = ?", participantID, id).
		First(&teamMember).Error; err != nil {
		utils.BadRequest(ctx, "您没有权限修改此作品")
		return
	}

	// 队长和队员都可以修改作品
	participantIDUint, _ := participantID.(uint64)
	if err := c.submissionService.UpdateSubmission(id, teamMember.TeamID, participantIDUint, &submission); err != nil {
		utils.BadRequest(ctx, err.Error())
		return
	}

	utils.Success(ctx, nil)
}

// GetSubmissionHistory 获取作品修改记录
func (c *ArenaSubmissionController) GetSubmissionHistory(ctx *gin.Context) {
	id, err := strconv.ParseUint(ctx.Param("id"), 10, 64)
	if err != nil {
		utils.BadRequest(ctx, "无效的作品ID")
		return
	}

	participantID, _ := ctx.Get("participant_id")

	// 查找用户所在的队伍
	var teamMember models.TeamMember
	if err := database.DB.Joins("JOIN teams ON team_members.team_id = teams.id").
		Joins("JOIN submissions ON submissions.team_id = teams.id").
		Where("team_members.participant_id = ? AND submissions.id = ?", participantID, id).
		First(&teamMember).Error; err != nil {
		utils.BadRequest(ctx, "您没有权限查看此作品的修改记录")
		return
	}

	histories, err := c.submissionService.GetSubmissionHistory(id)
	if err != nil {
		utils.InternalServerError(ctx, err.Error())
		return
	}

	utils.Success(ctx, histories)
}

