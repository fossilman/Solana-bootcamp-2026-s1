package controllers

import (
	"strconv"

	"github.com/gin-gonic/gin"
	"hackathon-backend/services"
	"hackathon-backend/utils"
)

type ArenaTeamController struct {
	teamService *services.TeamService
}

func NewArenaTeamController() *ArenaTeamController {
	return &ArenaTeamController{
		teamService: &services.TeamService{},
	}
}

// CreateTeam 创建队伍
func (c *ArenaTeamController) CreateTeam(ctx *gin.Context) {
	id, err := strconv.ParseUint(ctx.Param("id"), 10, 64)
	if err != nil {
		utils.BadRequest(ctx, "无效的活动ID")
		return
	}

	var req struct {
		Name    string `json:"name" binding:"required"`
		MaxSize int    `json:"max_size"`
	}

	if err := ctx.ShouldBindJSON(&req); err != nil {
		utils.BadRequest(ctx, "参数错误: "+err.Error())
		return
	}

	if req.MaxSize == 0 {
		req.MaxSize = 3 // 默认值
	}

	participantID, _ := ctx.Get("participant_id")

	team, err := c.teamService.CreateTeam(id, participantID.(uint64), req.Name, req.MaxSize)
	if err != nil {
		utils.BadRequest(ctx, err.Error())
		return
	}

	utils.Success(ctx, team)
}

// GetTeamList 获取队伍列表
func (c *ArenaTeamController) GetTeamList(ctx *gin.Context) {
	id, err := strconv.ParseUint(ctx.Param("id"), 10, 64)
	if err != nil {
		utils.BadRequest(ctx, "无效的活动ID")
		return
	}

	page, _ := strconv.Atoi(ctx.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(ctx.DefaultQuery("page_size", "10"))
	keyword := ctx.Query("keyword")

	teams, total, err := c.teamService.GetTeamList(id, page, pageSize, keyword)
	if err != nil {
		utils.InternalServerError(ctx, err.Error())
		return
	}

	utils.SuccessWithPagination(ctx, teams, page, pageSize, total)
}

// GetTeamByID 获取队伍详情
func (c *ArenaTeamController) GetTeamByID(ctx *gin.Context) {
	id, err := strconv.ParseUint(ctx.Param("id"), 10, 64)
	if err != nil {
		utils.BadRequest(ctx, "无效的队伍ID")
		return
	}

	team, err := c.teamService.GetTeamByID(id)
	if err != nil {
		utils.NotFound(ctx, "队伍不存在")
		return
	}

	utils.Success(ctx, team)
}

// JoinTeam 加入队伍
func (c *ArenaTeamController) JoinTeam(ctx *gin.Context) {
	id, err := strconv.ParseUint(ctx.Param("id"), 10, 64)
	if err != nil {
		utils.BadRequest(ctx, "无效的队伍ID")
		return
	}

	participantID, _ := ctx.Get("participant_id")

	if err := c.teamService.JoinTeam(id, participantID.(uint64)); err != nil {
		utils.BadRequest(ctx, err.Error())
		return
	}

	utils.Success(ctx, nil)
}

// LeaveTeam 退出队伍
func (c *ArenaTeamController) LeaveTeam(ctx *gin.Context) {
	id, err := strconv.ParseUint(ctx.Param("id"), 10, 64)
	if err != nil {
		utils.BadRequest(ctx, "无效的队伍ID")
		return
	}

	participantID, _ := ctx.Get("participant_id")

	if err := c.teamService.LeaveTeam(id, participantID.(uint64)); err != nil {
		utils.BadRequest(ctx, err.Error())
		return
	}

	utils.Success(ctx, nil)
}

// RemoveMember 移除成员
func (c *ArenaTeamController) RemoveMember(ctx *gin.Context) {
	teamID, err := strconv.ParseUint(ctx.Param("id"), 10, 64)
	if err != nil {
		utils.BadRequest(ctx, "无效的队伍ID")
		return
	}

	memberID, err := strconv.ParseUint(ctx.Param("member_id"), 10, 64)
	if err != nil {
		utils.BadRequest(ctx, "无效的成员ID")
		return
	}

	leaderID, _ := ctx.Get("participant_id")

	if err := c.teamService.RemoveMember(teamID, leaderID.(uint64), memberID); err != nil {
		utils.BadRequest(ctx, err.Error())
		return
	}

	utils.Success(ctx, nil)
}

// DissolveTeam 解散队伍
func (c *ArenaTeamController) DissolveTeam(ctx *gin.Context) {
	id, err := strconv.ParseUint(ctx.Param("id"), 10, 64)
	if err != nil {
		utils.BadRequest(ctx, "无效的队伍ID")
		return
	}

	leaderID, _ := ctx.Get("participant_id")

	if err := c.teamService.DissolveTeam(id, leaderID.(uint64)); err != nil {
		utils.BadRequest(ctx, err.Error())
		return
	}

	utils.Success(ctx, nil)
}

// GetUserTeam 获取用户在指定活动中的队伍信息
func (c *ArenaTeamController) GetUserTeam(ctx *gin.Context) {
	hackathonID, err := strconv.ParseUint(ctx.Param("id"), 10, 64)
	if err != nil {
		utils.BadRequest(ctx, "无效的活动ID")
		return
	}

	participantID, _ := ctx.Get("participant_id")

	team, err := c.teamService.GetUserTeam(hackathonID, participantID.(uint64))
	if err != nil {
		utils.InternalServerError(ctx, err.Error())
		return
	}

	utils.Success(ctx, team)
}

// UpdateTeam 更新队伍信息
func (c *ArenaTeamController) UpdateTeam(ctx *gin.Context) {
	id, err := strconv.ParseUint(ctx.Param("id"), 10, 64)
	if err != nil {
		utils.BadRequest(ctx, "无效的队伍ID")
		return
	}

	var updates map[string]interface{}
	if err := ctx.ShouldBindJSON(&updates); err != nil {
		utils.BadRequest(ctx, "参数错误: "+err.Error())
		return
	}

	leaderID, _ := ctx.Get("participant_id")

	if err := c.teamService.UpdateTeam(id, leaderID.(uint64), updates); err != nil {
		utils.BadRequest(ctx, err.Error())
		return
	}

	utils.Success(ctx, nil)
}

