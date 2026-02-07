package controllers

import (
	"strconv"

	"github.com/gin-gonic/gin"
	"hackathon-backend/services"
	"hackathon-backend/utils"
)

type AdminAuthController struct {
	userService *services.UserService
}

func NewAdminAuthController() *AdminAuthController {
	return &AdminAuthController{
		userService: &services.UserService{},
	}
}

// Login 登录（手机号+密码）
func (c *AdminAuthController) Login(ctx *gin.Context) {
	var req struct {
		Phone    string `json:"phone" binding:"required"`
		Password string `json:"password" binding:"required"`
	}

	if err := ctx.ShouldBindJSON(&req); err != nil {
		utils.BadRequest(ctx, "参数错误: "+err.Error())
		return
	}

	user, token, err := c.userService.Login(req.Phone, req.Password)
	if err != nil {
		utils.BadRequest(ctx, err.Error())
		return
	}

	utils.Success(ctx, gin.H{
		"token": token,
		"user": gin.H{
			"id":    user.ID,
			"name":  user.Name,
			"phone": user.Phone,
			"role":  user.Role,
		},
	})
}

// LoginWithWallet Web3钱包登录
func (c *AdminAuthController) LoginWithWallet(ctx *gin.Context) {
	var req struct {
		WalletAddress string `json:"wallet_address" binding:"required"`
		Phone         string `json:"phone" binding:"required"`
		Signature     string `json:"signature" binding:"required"` // 签名验证（后续可添加）
		WalletType    string `json:"wallet_type"`                 // 钱包类型：metamask | phantom，可选
	}

	if err := ctx.ShouldBindJSON(&req); err != nil {
		utils.BadRequest(ctx, "参数错误: "+err.Error())
		return
	}

	if req.WalletType == "" {
		req.WalletType = "metamask"
	}
	if req.WalletType != "metamask" && req.WalletType != "phantom" {
		req.WalletType = "metamask"
	}

	// 按钱包类型验证地址格式（Phantom 为 Solana 地址）
	if req.WalletType == "phantom" {
		if !utils.IsValidSolanaAddress(req.WalletAddress) {
			utils.BadRequest(ctx, "无效的 Solana 地址")
			return
		}
	} else {
		if len(req.WalletAddress) < 20 {
			utils.BadRequest(ctx, "无效的钱包地址")
			return
		}
	}
	// TODO: 验证签名（后续实现）

	user, token, err := c.userService.LoginWithWallet(req.WalletAddress, req.Phone, req.WalletType)
	if err != nil {
		utils.BadRequest(ctx, err.Error())
		return
	}

	utils.Success(ctx, gin.H{
		"token": token,
		"user": gin.H{
			"id":    user.ID,
			"name":  user.Name,
			"phone": user.Phone,
			"role":  user.Role,
		},
	})
}

// Logout 登出
func (c *AdminAuthController) Logout(ctx *gin.Context) {
	// JWT是无状态的，客户端删除token即可
	utils.Success(ctx, nil)
}

// GetProfile 获取当前用户信息
func (c *AdminAuthController) GetProfile(ctx *gin.Context) {
	userID, _ := ctx.Get("user_id")
	user, err := c.userService.GetCurrentUser(userID.(uint64))
	if err != nil {
		utils.NotFound(ctx, "用户不存在")
		return
	}

	utils.Success(ctx, user)
}

// UpdateProfile 更新当前用户信息
func (c *AdminAuthController) UpdateProfile(ctx *gin.Context) {
	userID, _ := ctx.Get("user_id")

	var updates map[string]interface{}
	if err := ctx.ShouldBindJSON(&updates); err != nil {
		utils.BadRequest(ctx, "参数错误: "+err.Error())
		return
	}

	// 不允许修改角色
	if _, ok := updates["role"]; ok {
		utils.BadRequest(ctx, "不允许修改角色")
		return
	}

	if err := c.userService.UpdateCurrentUser(userID.(uint64), updates); err != nil {
		utils.BadRequest(ctx, err.Error())
		return
	}

	utils.Success(ctx, nil)
}

// ChangePassword 修改当前用户密码
func (c *AdminAuthController) ChangePassword(ctx *gin.Context) {
	userID, _ := ctx.Get("user_id")

	var req struct {
		OldPassword string `json:"old_password" binding:"required"`
		NewPassword string `json:"new_password" binding:"required,min=8"`
	}

	if err := ctx.ShouldBindJSON(&req); err != nil {
		utils.BadRequest(ctx, "参数错误: "+err.Error())
		return
	}

	if err := c.userService.UpdatePassword(userID.(uint64), req.OldPassword, req.NewPassword); err != nil {
		utils.BadRequest(ctx, err.Error())
		return
	}

	utils.Success(ctx, nil)
}

// GetWallets 获取当前用户的钱包地址列表
func (c *AdminAuthController) GetWallets(ctx *gin.Context) {
	userID, _ := ctx.Get("user_id")
	wallets, err := c.userService.GetUserWallets(userID.(uint64))
	if err != nil {
		utils.InternalServerError(ctx, err.Error())
		return
	}
	utils.Success(ctx, wallets)
}

// DeleteWallet 删除钱包地址
func (c *AdminAuthController) DeleteWallet(ctx *gin.Context) {
	userID, _ := ctx.Get("user_id")
	walletID, err := strconv.ParseUint(ctx.Param("id"), 10, 64)
	if err != nil {
		utils.BadRequest(ctx, "无效的钱包ID")
		return
	}

	if err := c.userService.UnbindWallet(userID.(uint64), walletID); err != nil {
		utils.BadRequest(ctx, err.Error())
		return
	}

	utils.Success(ctx, nil)
}

