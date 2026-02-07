package controllers

import (
	"encoding/json"
	"strconv"
	"strings"

	"hackathon-backend/config"
	"hackathon-backend/models"
	"hackathon-backend/services"
	"hackathon-backend/solana"
	"hackathon-backend/utils"

	"github.com/gin-gonic/gin"
)

type SponsorController struct {
	sponsorService   *services.SponsorService
	hackathonService *services.HackathonService
}

func NewSponsorController() *SponsorController {
	return &SponsorController{
		sponsorService:   &services.SponsorService{},
		hackathonService: &services.HackathonService{},
	}
}

// PrepareSponsorApply 返回赞助商申请页构建链上 sponsor_apply 交易所需的 program_id、rpc_url（无需登录）。
// 若链上 sponsor config 未初始化且已配置 SOLANA_AUTHORITY_KEY，会先自动执行一次 initialize_sponsor_config。
func (c *SponsorController) PrepareSponsorApply(ctx *gin.Context) {
	if err := solana.EnsureSponsorConfigInitialized(); err != nil {
		utils.BadRequest(ctx, "赞助商链上配置未就绪: "+err.Error())
		return
	}
	programID, rpcURL, err := solana.PreparePublishConfig()
	if err != nil {
		utils.BadRequest(ctx, err.Error())
		return
	}
	utils.Success(ctx, gin.H{
		"program_id": programID,
		"rpc_url":    rpcURL,
	})
}

// CreateApplication 提交赞助申请（无需登录）。申请创建后需由前端用钱包对链上 sponsor_apply 交易签名并发送，金额转入金库。
func (c *SponsorController) CreateApplication(ctx *gin.Context) {
	var req struct {
		Phone         string   `json:"phone" binding:"required"`
		LogoURL       *string  `json:"logo_url,omitempty"`
		SponsorType   string   `json:"sponsor_type" binding:"required,oneof=long_term event_specific"`
		EventIDs      []uint64 `json:"event_ids"`
		AmountSol     float64  `json:"amount_sol" binding:"required"`
		WalletAddress string   `json:"wallet_address" binding:"required"` // 赞助商链上钱包（申请时签名转入金库的地址），审核链上指令需要
	}

	if err := ctx.ShouldBindJSON(&req); err != nil {
		utils.BadRequest(ctx, "参数错误: "+err.Error())
		return
	}

	// 验证手机号格式（11位数字）
	if len(req.Phone) != 11 {
		utils.BadRequest(ctx, "手机号格式错误，请输入11位数字")
		return
	}

	if req.AmountSol <= 0 {
		utils.BadRequest(ctx, "赞助金额必须大于 0 SOL")
		return
	}

	// 如果是活动指定赞助，必须选择活动
	if req.SponsorType == "event_specific" && len(req.EventIDs) == 0 {
		utils.BadRequest(ctx, "活动指定赞助必须选择至少一个活动")
		return
	}

	// 将活动ID列表转换为JSON字符串
	var eventIDsJSON string
	if len(req.EventIDs) > 0 {
		eventIDsBytes, err := json.Marshal(req.EventIDs)
		if err != nil {
			utils.BadRequest(ctx, "活动ID格式错误")
			return
		}
		eventIDsJSON = string(eventIDsBytes)
	}

	// 处理LogoURL，如果为nil则使用空字符串
	logoURL := ""
	if req.LogoURL != nil {
		logoURL = *req.LogoURL
	}

	application := models.SponsorApplication{
		Phone:         req.Phone,
		LogoURL:       logoURL,
		SponsorType:   req.SponsorType,
		EventIDs:      eventIDsJSON,
		AmountSol:     req.AmountSol,
		WalletAddress: strings.TrimSpace(req.WalletAddress),
		Status:        "pending",
	}

	if err := c.sponsorService.CreateApplication(&application); err != nil {
		utils.BadRequest(ctx, err.Error())
		return
	}

	utils.Success(ctx, gin.H{
		"application_id": application.ID,
		"message":        "申请已提交，请使用手机号查询审核结果",
	})
}

// SubmitSponsorApplyTransaction 接收前端已签名的 sponsor_apply 交易（base64），提交到链上并返回交易签名。
func (c *SponsorController) SubmitSponsorApplyTransaction(ctx *gin.Context) {
	var req struct {
		SignedTransaction string `json:"signed_transaction" binding:"required"`
	}
	if err := ctx.ShouldBindJSON(&req); err != nil {
		utils.BadRequest(ctx, "参数错误: 缺少 signed_transaction")
		return
	}
	_, rpcURL, err := solana.PreparePublishConfig()
	if err != nil {
		utils.BadRequest(ctx, err.Error())
		return
	}
	sig, err := solana.SubmitSignedTransaction(req.SignedTransaction, rpcURL)
	if err != nil {
		utils.BadRequest(ctx, "链上提交失败: "+err.Error())
		return
	}
	utils.Success(ctx, gin.H{"signature": sig})
}

// QueryApplication 查询申请结果（无需登录）
func (c *SponsorController) QueryApplication(ctx *gin.Context) {
	phone := ctx.Query("phone")
	if phone == "" {
		utils.BadRequest(ctx, "请输入手机号")
		return
	}

	application, err := c.sponsorService.GetApplicationByPhone(phone)
	if err != nil {
		utils.Success(ctx, gin.H{
			"status":  "not_found",
			"message": "未找到相关申请记录",
		})
		return
	}

	var message string
	switch application.Status {
	case "pending":
		message = "您的申请正在审核中，请耐心等待"
	case "approved":
		message = "恭喜！您的申请已通过，账号已自动创建，请使用手机号登录"
	case "rejected":
		message = "很抱歉，您的申请未通过审核"
	default:
		message = "申请状态未知"
	}

	resp := gin.H{
		"status":     application.Status,
		"message":    message,
		"created_at": application.CreatedAt,
	}
	if programID := strings.TrimSpace(config.AppConfig.Solana.ProgramID); programID != "" {
		if vaultPDA, err := solana.SponsorTreasuryPDA(programID); err == nil {
			resp["vault_address"] = vaultPDA.String()
		}
		if configPDA, err := solana.SponsorConfigPDA(programID); err == nil {
			resp["sponsor_config_address"] = configPDA.String()
		}
		if appPDA, err := solana.SponsorApplicationPDA(programID, uint64(application.ID)); err == nil {
			resp["sponsor_application_address"] = appPDA.String()
		}
	}
	utils.Success(ctx, resp)
}

// PrepareSponsorReview 返回主办方链上审核（approve_sponsor/reject_sponsor）所需数据，供前端用钱包签名。需 Admin 权限。
func (c *SponsorController) PrepareSponsorReview(ctx *gin.Context) {
	applicationIDStr := ctx.Query("application_id")
	if applicationIDStr == "" {
		utils.BadRequest(ctx, "缺少 application_id")
		return
	}
	applicationID, err := strconv.ParseUint(applicationIDStr, 10, 64)
	if err != nil {
		utils.BadRequest(ctx, "无效的 application_id")
		return
	}
	programID, rpcURL, err := solana.PreparePublishConfig()
	if err != nil {
		utils.BadRequest(ctx, err.Error())
		return
	}
	application, err := c.sponsorService.GetApplicationByID(applicationID)
	if err != nil || application == nil {
		utils.BadRequest(ctx, "申请不存在")
		return
	}
	if application.Status != "pending" {
		utils.BadRequest(ctx, "该申请已审核")
		return
	}
	if application.WalletAddress == "" {
		utils.BadRequest(ctx, "该申请缺少链上钱包地址，无法执行链上审核")
		return
	}
	adminWallet := strings.TrimSpace(config.AppConfig.Solana.SponsorAdminWallet)
	if adminWallet == "" {
		utils.BadRequest(ctx, "未配置主办方钱包（SOLANA_SPONSOR_ADMIN_WALLET / sponsor_admin_wallet）")
		return
	}
	utils.Success(ctx, gin.H{
		"program_id":     programID,
		"rpc_url":        rpcURL,
		"admin_wallet":   adminWallet,
		"sponsor_wallet": application.WalletAddress,
		"application_id": applicationID,
	})
}

// GetPendingApplications 获取待审核列表（Admin权限）
func (c *SponsorController) GetPendingApplications(ctx *gin.Context) {
	page, _ := strconv.Atoi(ctx.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(ctx.DefaultQuery("page_size", "20"))

	applications, total, err := c.sponsorService.GetPendingApplications(page, pageSize)
	if err != nil {
		utils.InternalServerError(ctx, err.Error())
		return
	}

	// 解析EventIDs JSON字符串
	for i := range applications {
		if applications[i].EventIDs != "" {
			var eventIDs []uint64
			if err := json.Unmarshal([]byte(applications[i].EventIDs), &eventIDs); err == nil {
				// 将解析后的活动ID列表添加到响应中（通过临时字段）
				// 注意：这里我们需要在响应中手动添加，因为EventIDs字段是字符串
			}
		}
	}

	utils.SuccessWithPagination(ctx, applications, page, pageSize, total)
}

// GetReviewedApplications 获取已审核列表（Admin权限）
func (c *SponsorController) GetReviewedApplications(ctx *gin.Context) {
	page, _ := strconv.Atoi(ctx.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(ctx.DefaultQuery("page_size", "20"))
	status := ctx.DefaultQuery("status", "all")

	applications, total, err := c.sponsorService.GetReviewedApplications(page, pageSize, status)
	if err != nil {
		utils.InternalServerError(ctx, err.Error())
		return
	}

	utils.SuccessWithPagination(ctx, applications, page, pageSize, total)
}

// ReviewApplication 审核申请（Admin权限）。若传入 signed_transaction，先提交链上审核指令（主办方钱包已签名），成功后再更新 DB。
func (c *SponsorController) ReviewApplication(ctx *gin.Context) {
	id, err := strconv.ParseUint(ctx.Param("id"), 10, 64)
	if err != nil {
		utils.BadRequest(ctx, "无效的申请ID")
		return
	}

	var req struct {
		Action            string `json:"action" binding:"required,oneof=approve reject"`
		RejectReason      string `json:"reject_reason"`
		SignedTransaction string `json:"signed_transaction"` // 主办方钱包签名的 approve_sponsor 或 reject_sponsor 交易（base64），若提供则先提交链上
	}

	if err := ctx.ShouldBindJSON(&req); err != nil {
		utils.BadRequest(ctx, "参数错误: "+err.Error())
		return
	}

	userID, _ := ctx.Get("user_id")
	action := "approved"
	if req.Action == "reject" {
		action = "rejected"
	}

	if req.SignedTransaction != "" {
		_, rpcURL, errConfig := solana.PreparePublishConfig()
		if errConfig != nil {
			utils.BadRequest(ctx, errConfig.Error())
			return
		}
		if _, err := solana.SubmitSignedTransaction(strings.TrimSpace(req.SignedTransaction), rpcURL); err != nil {
			utils.BadRequest(ctx, "链上审核交易提交失败: "+err.Error())
			return
		}
	}

	if err := c.sponsorService.ReviewApplication(id, action, userID.(uint64), req.RejectReason); err != nil {
		utils.BadRequest(ctx, err.Error())
		return
	}

	utils.Success(ctx, gin.H{
		"message": "审核成功",
	})
}

// GetLongTermSponsors 获取长期赞助商列表（Arena平台）
func (c *SponsorController) GetLongTermSponsors(ctx *gin.Context) {
	sponsors, err := c.sponsorService.GetLongTermSponsors()
	if err != nil {
		utils.InternalServerError(ctx, err.Error())
		return
	}

	utils.Success(ctx, sponsors)
}

// GetEventSponsors 获取活动的指定赞助商列表（Arena平台）
func (c *SponsorController) GetEventSponsors(ctx *gin.Context) {
	hackathonID, err := strconv.ParseUint(ctx.Param("id"), 10, 64)
	if err != nil {
		utils.BadRequest(ctx, "无效的活动ID")
		return
	}

	sponsors, err := c.sponsorService.GetEventSponsors(hackathonID)
	if err != nil {
		utils.InternalServerError(ctx, err.Error())
		return
	}

	utils.Success(ctx, sponsors)
}

// GetPublishedHackathons 获取已发布的活动列表（供赞助商申请使用，无需登录）
func (c *SponsorController) GetPublishedHackathons(ctx *gin.Context) {
	page, _ := strconv.Atoi(ctx.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(ctx.DefaultQuery("page_size", "100"))

	hackathons, total, err := c.hackathonService.GetPublishedHackathons(page, pageSize, "published", "", "time_desc")
	if err != nil {
		utils.InternalServerError(ctx, err.Error())
		return
	}

	utils.SuccessWithPagination(ctx, hackathons, page, pageSize, total)
}
