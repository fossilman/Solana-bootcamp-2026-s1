package controllers

import (
	"fmt"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"hackathon-backend/models"
	"hackathon-backend/services"
	"hackathon-backend/utils"
)

type AdminHackathonController struct {
	hackathonService *services.HackathonService
}

func NewAdminHackathonController() *AdminHackathonController {
	return &AdminHackathonController{
		hackathonService: &services.HackathonService{},
	}
}

// CreateHackathon 创建活动（仅主办方可创建，Admin不能创建）
func (c *AdminHackathonController) CreateHackathon(ctx *gin.Context) {
	// 检查角色：Admin不能创建活动
	role, _ := ctx.Get("role")
	if role.(string) == "admin" {
		utils.Forbidden(ctx, "Admin不能创建活动")
		return
	}

	var req struct {
		models.Hackathon
		Stages          []models.HackathonStage `json:"stages"`
		Awards          []models.HackathonAward  `json:"awards"`
		AutoAssignStages bool                   `json:"auto_assign_stages"` // 是否自动分配阶段时间
	}

	if err := ctx.ShouldBindJSON(&req); err != nil {
		utils.BadRequest(ctx, "参数错误: "+err.Error())
		return
	}

	// 获取当前用户ID
	organizerID, _ := ctx.Get("user_id")
	req.Hackathon.OrganizerID = organizerID.(uint64)
	req.Hackathon.Status = "preparation"

	// 确保开始时间的时分秒为00:00:00，结束时间的时分秒为23:59:59
	startTime := req.Hackathon.StartTime
	req.Hackathon.StartTime = time.Date(startTime.Year(), startTime.Month(), startTime.Day(), 0, 0, 0, 0, startTime.Location())
	endTime := req.Hackathon.EndTime
	req.Hackathon.EndTime = time.Date(endTime.Year(), endTime.Month(), endTime.Day(), 23, 59, 59, 0, endTime.Location())

	if err := c.hackathonService.CreateHackathon(&req.Hackathon, req.Stages, req.Awards, req.AutoAssignStages); err != nil {
		utils.BadRequest(ctx, err.Error())
		return
	}

	utils.Success(ctx, req.Hackathon)
}

// GetHackathonList 获取活动列表
// 根据权限矩阵：所有主办方可以看到所有活动
func (c *AdminHackathonController) GetHackathonList(ctx *gin.Context) {
	page, _ := strconv.Atoi(ctx.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(ctx.DefaultQuery("page_size", "10"))
	status := ctx.Query("status")
	keyword := ctx.Query("keyword")
	sort := ctx.DefaultQuery("sort", "created_at_desc")

	// 所有主办方和Admin都可以看到所有活动，不再过滤organizerID
	hackathons, total, err := c.hackathonService.GetHackathonList(page, pageSize, status, keyword, sort, nil)
	if err != nil {
		utils.InternalServerError(ctx, err.Error())
		return
	}

	utils.SuccessWithPagination(ctx, hackathons, page, pageSize, total)
}

// GetHackathonByID 获取活动详情
func (c *AdminHackathonController) GetHackathonByID(ctx *gin.Context) {
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

	utils.Success(ctx, hackathon)
}

// UpdateHackathon 更新活动（仅活动创建者可编辑）
func (c *AdminHackathonController) UpdateHackathon(ctx *gin.Context) {
	id, err := strconv.ParseUint(ctx.Param("id"), 10, 64)
	if err != nil {
		utils.BadRequest(ctx, "无效的活动ID")
		return
	}

	// 获取当前用户信息
	userID, _ := ctx.Get("user_id")
	role, _ := ctx.Get("role")

	var req struct {
		models.Hackathon
		Stages []models.HackathonStage `json:"stages"`
		Awards []models.HackathonAward  `json:"awards"`
	}

	if err := ctx.ShouldBindJSON(&req); err != nil {
		utils.BadRequest(ctx, "参数错误: "+err.Error())
		return
	}

	if err := c.hackathonService.UpdateHackathon(id, &req.Hackathon, req.Stages, req.Awards, userID.(uint64), role.(string)); err != nil {
		utils.BadRequest(ctx, err.Error())
		return
	}

	utils.Success(ctx, nil)
}

// DeleteHackathon 删除活动（仅活动创建者可删除，且仅预备状态）
func (c *AdminHackathonController) DeleteHackathon(ctx *gin.Context) {
	id, err := strconv.ParseUint(ctx.Param("id"), 10, 64)
	if err != nil {
		utils.BadRequest(ctx, "无效的活动ID")
		return
	}

	// 获取当前用户信息
	userID, _ := ctx.Get("user_id")
	role, _ := ctx.Get("role")

	if err := c.hackathonService.DeleteHackathon(id, userID.(uint64), role.(string)); err != nil {
		utils.BadRequest(ctx, err.Error())
		return
	}

	utils.Success(ctx, nil)
}

// PreparePublish 返回发布活动所需数据，供前端用钱包（Phantom）构建并签名交易，无需后端配置私钥。
func (c *AdminHackathonController) PreparePublish(ctx *gin.Context) {
	id, err := strconv.ParseUint(ctx.Param("id"), 10, 64)
	if err != nil {
		utils.BadRequest(ctx, "无效的活动ID")
		return
	}
	userID, _ := ctx.Get("user_id")
	role, _ := ctx.Get("role")
	result, err := c.hackathonService.PreparePublish(id, userID.(uint64), role.(string))
	if err != nil {
		utils.BadRequest(ctx, err.Error())
		return
	}
	utils.Success(ctx, result)
}

// PublishHackathon 发布活动：接收前端钱包已签名的交易并提交上链，链上地址由前端计算 PDA 传入。上链失败则返回错误，活动不发布。
func (c *AdminHackathonController) PublishHackathon(ctx *gin.Context) {
	id, err := strconv.ParseUint(ctx.Param("id"), 10, 64)
	if err != nil {
		utils.BadRequest(ctx, "无效的活动ID")
		return
	}
	var body struct {
		SignedTransaction string `json:"signed_transaction"`
		ActivityPDA       string `json:"activity_pda"`
	}
	if err := ctx.ShouldBindJSON(&body); err != nil {
		utils.BadRequest(ctx, "请使用钱包授权后提交已签名交易（signed_transaction、activity_pda）")
		return
	}
	userID, _ := ctx.Get("user_id")
	role, _ := ctx.Get("role")
	result, err := c.hackathonService.PublishHackathon(id, userID.(uint64), role.(string), body.SignedTransaction, body.ActivityPDA)
	if err != nil {
		utils.BadRequest(ctx, err.Error())
		return
	}
	utils.Success(ctx, result)
}

// UpdateChainActivityAddress 更新活动链上地址（仅活动创建者可更新，上链后补填 PDA）
func (c *AdminHackathonController) UpdateChainActivityAddress(ctx *gin.Context) {
	id, err := strconv.ParseUint(ctx.Param("id"), 10, 64)
	if err != nil {
		utils.BadRequest(ctx, "无效的活动ID")
		return
	}
	var body struct {
		ChainActivityAddress string `json:"chain_activity_address"`
	}
	if err := ctx.ShouldBindJSON(&body); err != nil {
		utils.BadRequest(ctx, "参数错误")
		return
	}
	userID, _ := ctx.Get("user_id")
	role, _ := ctx.Get("role")
	if err := c.hackathonService.UpdateChainActivityAddress(id, userID.(uint64), role.(string), body.ChainActivityAddress); err != nil {
		utils.BadRequest(ctx, err.Error())
		return
	}
	utils.Success(ctx, nil)
}

// PrepareSwitchStage 返回切换阶段时如需更新链上状态，前端构建并签名交易所需的数据。
func (c *AdminHackathonController) PrepareSwitchStage(ctx *gin.Context) {
	id, err := strconv.ParseUint(ctx.Param("id"), 10, 64)
	if err != nil {
		utils.BadRequest(ctx, "无效的活动ID")
		return
	}
	stage := ctx.Param("stage")
	if stage == "" {
		utils.BadRequest(ctx, "阶段参数不能为空")
		return
	}
	userID, _ := ctx.Get("user_id")
	role, _ := ctx.Get("role")
	result, err := c.hackathonService.PrepareSwitchStage(id, stage, userID.(uint64), role.(string))
	if err != nil {
		utils.BadRequest(ctx, err.Error())
		return
	}
	utils.Success(ctx, result)
}

// SwitchStage 切换活动阶段（仅活动创建者可切换）。若阶段为 registration/checkin 且活动已上链，需传 signed_transaction。
func (c *AdminHackathonController) SwitchStage(ctx *gin.Context) {
	id, err := strconv.ParseUint(ctx.Param("id"), 10, 64)
	if err != nil {
		utils.BadRequest(ctx, "无效的活动ID")
		return
	}

	stage := ctx.Param("stage")
	if stage == "" {
		utils.BadRequest(ctx, "阶段参数不能为空")
		return
	}

	// 可选：切换为 registration/checkin 且活动已上链时，需传主办方已签名交易
	var body struct {
		SignedTransaction string `json:"signed_transaction"`
	}
	_ = ctx.ShouldBindJSON(&body)

	userID, _ := ctx.Get("user_id")
	role, _ := ctx.Get("role")

	if err := c.hackathonService.SwitchStage(id, stage, userID.(uint64), role.(string), body.SignedTransaction); err != nil {
		utils.BadRequest(ctx, err.Error())
		return
	}

	utils.Success(ctx, nil)
}

// ArchiveHackathon 归档活动（Admin和活动创建者可归档已发布的活动）
func (c *AdminHackathonController) ArchiveHackathon(ctx *gin.Context) {
	id, err := strconv.ParseUint(ctx.Param("id"), 10, 64)
	if err != nil {
		utils.BadRequest(ctx, "无效的活动ID")
		return
	}

	// 获取当前用户信息
	userID, _ := ctx.Get("user_id")
	role, _ := ctx.Get("role")

	// 检查权限：Admin或活动创建者可以归档
	if role.(string) != "admin" {
		// 检查是否是活动创建者
		isCreator, err := c.hackathonService.CheckHackathonCreator(id, userID.(uint64))
		if err != nil {
			utils.BadRequest(ctx, "活动不存在")
			return
		}
		if !isCreator {
			utils.Forbidden(ctx, "只能归档自己创建的活动")
			return
		}
	}

	if err := c.hackathonService.ArchiveHackathon(id); err != nil {
		utils.BadRequest(ctx, err.Error())
		return
	}

	utils.Success(ctx, nil)
}

// BatchArchiveHackathons 批量归档活动（仅活动创建者或Admin可以执行）
func (c *AdminHackathonController) BatchArchiveHackathons(ctx *gin.Context) {
	var req struct {
		IDs []uint64 `json:"ids" binding:"required"`
	}

	if err := ctx.ShouldBindJSON(&req); err != nil {
		utils.BadRequest(ctx, "参数错误: "+err.Error())
		return
	}

	// 获取当前用户信息
	userID, _ := ctx.Get("user_id")
	role, _ := ctx.Get("role")

	// 检查权限：Admin或活动创建者可以批量归档
	if role.(string) != "admin" {
		// 检查所有活动是否都是当前用户创建的
		for _, id := range req.IDs {
			isCreator, err := c.hackathonService.CheckHackathonCreator(id, userID.(uint64))
			if err != nil || !isCreator {
				utils.Forbidden(ctx, "只能归档自己创建的活动")
				return
			}
		}
	}

	if err := c.hackathonService.BatchArchiveHackathons(req.IDs); err != nil {
		utils.BadRequest(ctx, err.Error())
		return
	}

	utils.Success(ctx, nil)
}

// UnarchiveHackathon 取消归档活动（Admin和活动创建者可取消归档）
func (c *AdminHackathonController) UnarchiveHackathon(ctx *gin.Context) {
	id, err := strconv.ParseUint(ctx.Param("id"), 10, 64)
	if err != nil {
		utils.BadRequest(ctx, "无效的活动ID")
		return
	}

	// 获取当前用户信息
	userID, _ := ctx.Get("user_id")
	role, _ := ctx.Get("role")

	// 检查权限：Admin或活动创建者可以取消归档
	if role.(string) != "admin" {
		// 检查是否是活动创建者
		isCreator, err := c.hackathonService.CheckHackathonCreator(id, userID.(uint64))
		if err != nil {
			utils.BadRequest(ctx, "活动不存在")
			return
		}
		if !isCreator {
			utils.Forbidden(ctx, "只能取消归档自己创建的活动")
			return
		}
	}

	if err := c.hackathonService.UnarchiveHackathon(id); err != nil {
		utils.BadRequest(ctx, err.Error())
		return
	}

	utils.Success(ctx, nil)
}

// UpdateStageTimes 更新活动阶段时间（仅活动创建者可设置）
func (c *AdminHackathonController) UpdateStageTimes(ctx *gin.Context) {
	id, err := strconv.ParseUint(ctx.Param("id"), 10, 64)
	if err != nil {
		utils.BadRequest(ctx, "无效的活动ID")
		return
	}

	// 获取当前用户信息
	userID, _ := ctx.Get("user_id")
	role, _ := ctx.Get("role")

	var req struct {
		Stages []models.HackathonStage `json:"stages" binding:"required"`
	}

	if err := ctx.ShouldBindJSON(&req); err != nil {
		utils.BadRequest(ctx, "参数错误: "+err.Error())
		return
	}

	if err := c.hackathonService.UpdateStageTimes(id, req.Stages, userID.(uint64), role.(string)); err != nil {
		utils.BadRequest(ctx, err.Error())
		return
	}

	utils.Success(ctx, nil)
}

// GetStageTimes 获取活动阶段时间设置
func (c *AdminHackathonController) GetStageTimes(ctx *gin.Context) {
	id, err := strconv.ParseUint(ctx.Param("id"), 10, 64)
	if err != nil {
		utils.BadRequest(ctx, "无效的活动ID")
		return
	}

	stages, err := c.hackathonService.GetStageTimes(id)
	if err != nil {
		utils.BadRequest(ctx, err.Error())
		return
	}

	utils.Success(ctx, stages)
}

// GetHackathonStats 获取活动统计信息
func (c *AdminHackathonController) GetHackathonStats(ctx *gin.Context) {
	id, err := strconv.ParseUint(ctx.Param("id"), 10, 64)
	if err != nil {
		utils.BadRequest(ctx, "无效的活动ID")
		return
	}

	stats, err := c.hackathonService.GetHackathonStats(id)
	if err != nil {
		utils.BadRequest(ctx, err.Error())
		return
	}

	utils.Success(ctx, stats)
}

// GetHackathonStatsDetail 获取活动统计详情（报名人数、签到人数、队伍数量、作品数量）
func (c *AdminHackathonController) GetHackathonStatsDetail(ctx *gin.Context) {
	id, err := strconv.ParseUint(ctx.Param("id"), 10, 64)
	if err != nil {
		utils.BadRequest(ctx, "无效的活动ID")
		return
	}

	statsType := ctx.Param("type") // registrations, checkins, teams, submissions
	if statsType == "" {
		utils.BadRequest(ctx, "统计类型不能为空")
		return
	}

	page, _ := strconv.Atoi(ctx.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(ctx.DefaultQuery("page_size", "20"))
	keyword := ctx.Query("keyword")

	detail, total, err := c.hackathonService.GetHackathonStatsDetail(id, statsType, page, pageSize, keyword)
	if err != nil {
		utils.InternalServerError(ctx, err.Error())
		return
	}

	utils.SuccessWithPagination(ctx, detail, page, pageSize, total)
}

// GetPosterQRCode 获取活动海报二维码
func (c *AdminHackathonController) GetPosterQRCode(ctx *gin.Context) {
	id, err := strconv.ParseUint(ctx.Param("id"), 10, 64)
	if err != nil {
		utils.BadRequest(ctx, "无效的活动ID")
		return
	}

	qrCodeURL, err := c.hackathonService.GetPosterQRCode(id)
	if err != nil {
		utils.BadRequest(ctx, err.Error())
		return
	}

	utils.Success(ctx, gin.H{
		"qr_code_url": qrCodeURL,
		"poster_url":  fmt.Sprintf("/posters/%d", id),
	})
}

