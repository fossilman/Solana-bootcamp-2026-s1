package controllers

import (
	"strconv"

	"github.com/gin-gonic/gin"
	"hackathon-backend/services"
	"hackathon-backend/utils"
)

type ArenaHackathonController struct {
	hackathonService *services.HackathonService
}

func NewArenaHackathonController() *ArenaHackathonController {
	return &ArenaHackathonController{
		hackathonService: &services.HackathonService{},
	}
}

// GetHackathonList 获取已发布的活动列表
func (c *ArenaHackathonController) GetHackathonList(ctx *gin.Context) {
	page, _ := strconv.Atoi(ctx.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(ctx.DefaultQuery("page_size", "10"))
	status := ctx.Query("status")
	keyword := ctx.Query("keyword")
	sort := ctx.DefaultQuery("sort", "time_desc")

	hackathons, total, err := c.hackathonService.GetPublishedHackathons(page, pageSize, status, keyword, sort)
	if err != nil {
		utils.InternalServerError(ctx, err.Error())
		return
	}

	utils.SuccessWithPagination(ctx, hackathons, page, pageSize, total)
}

// GetHackathonByID 获取活动详情
func (c *ArenaHackathonController) GetHackathonByID(ctx *gin.Context) {
	id, err := strconv.ParseUint(ctx.Param("id"), 10, 64)
	if err != nil {
		utils.BadRequest(ctx, "无效的活动ID")
		return
	}

	hackathon, err := c.hackathonService.GetHackathonByID(id)
	if err != nil {
		utils.NotFound(ctx, "活动不存在")
		return
	}

	// 检查活动是否已发布
	if hackathon.Status == "preparation" {
		utils.NotFound(ctx, "活动不存在")
		return
	}

	utils.Success(ctx, hackathon)
}

// GetMyHackathons 获取已报名的活动列表
func (c *ArenaHackathonController) GetMyHackathons(ctx *gin.Context) {
	participantID, _ := ctx.Get("participant_id")
	page, _ := strconv.Atoi(ctx.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(ctx.DefaultQuery("page_size", "10"))
	status := ctx.Query("status")
	keyword := ctx.Query("keyword")
	sort := ctx.DefaultQuery("sort", "time_desc")

	hackathons, total, err := c.hackathonService.GetMyHackathons(participantID.(uint64), page, pageSize, status, keyword, sort)
	if err != nil {
		utils.InternalServerError(ctx, err.Error())
		return
	}

	utils.SuccessWithPagination(ctx, hackathons, page, pageSize, total)
}

// GetArchiveList 获取活动集锦列表（已结束的活动）
func (c *ArenaHackathonController) GetArchiveList(ctx *gin.Context) {
	page, _ := strconv.Atoi(ctx.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(ctx.DefaultQuery("page_size", "10"))
	keyword := ctx.Query("keyword")
	timeRange := ctx.Query("time_range") // 最近一个月、最近三个月、最近半年、全部

	hackathons, total, err := c.hackathonService.GetArchiveHackathons(page, pageSize, keyword, timeRange)
	if err != nil {
		utils.InternalServerError(ctx, err.Error())
		return
	}

	utils.SuccessWithPagination(ctx, hackathons, page, pageSize, total)
}

// GetArchiveDetail 获取活动集锦详情（包括作品、投票结果、比赛结果）
func (c *ArenaHackathonController) GetArchiveDetail(ctx *gin.Context) {
	id, err := strconv.ParseUint(ctx.Param("id"), 10, 64)
	if err != nil {
		utils.BadRequest(ctx, "无效的活动ID")
		return
	}

	archive, err := c.hackathonService.GetArchiveDetail(id)
	if err != nil {
		utils.NotFound(ctx, err.Error())
		return
	}

	utils.Success(ctx, archive)
}

