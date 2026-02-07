package controllers

import (
	"encoding/base64"
	"regexp"
	"strings"

	"github.com/ethereum/go-ethereum/common"
	"github.com/gin-gonic/gin"
	"hackathon-backend/services"
	"hackathon-backend/utils"
)

type ArenaAuthController struct {
	participantService *services.ParticipantService
}

func NewArenaAuthController() *ArenaAuthController {
	return &ArenaAuthController{
		participantService: &services.ParticipantService{},
	}
}

// Connect 连接钱包，获取nonce
func (c *ArenaAuthController) Connect(ctx *gin.Context) {
	var req struct {
		WalletAddress string `json:"wallet_address" binding:"required"`
		WalletType    string `json:"wallet_type"` // 可选：metamask | phantom
	}

	if err := ctx.ShouldBindJSON(&req); err != nil {
		utils.BadRequest(ctx, "参数错误: "+err.Error())
		return
	}

	// 按钱包类型校验地址格式
	if req.WalletType == "phantom" {
		if !utils.IsValidSolanaAddress(req.WalletAddress) {
			utils.BadRequest(ctx, "无效的 Solana 地址格式")
			return
		}
	} else {
		if !isValidEthereumAddress(req.WalletAddress) {
			utils.BadRequest(ctx, "无效的钱包地址格式")
			return
		}
	}

	nonce, err := c.participantService.ConnectWallet(req.WalletAddress, req.WalletType)
	if err != nil {
		utils.BadRequest(ctx, err.Error())
		return
	}

	utils.Success(ctx, gin.H{
		"nonce": nonce,
	})
}

// Verify 验证签名，完成登录
func (c *ArenaAuthController) Verify(ctx *gin.Context) {
	var req struct {
		WalletAddress string `json:"wallet_address" binding:"required"`
		Signature     string `json:"signature" binding:"required"`
		WalletType    string `json:"wallet_type"` // 可选：metamask | phantom
	}

	if err := ctx.ShouldBindJSON(&req); err != nil {
		utils.BadRequest(ctx, "参数错误: "+err.Error())
		return
	}

	// 按钱包类型校验地址与签名格式
	if req.WalletType == "phantom" {
		if !utils.IsValidSolanaAddress(req.WalletAddress) {
			utils.BadRequest(ctx, "无效的 Solana 地址格式")
			return
		}
		if !isValidSolanaSignature(req.Signature) {
			utils.BadRequest(ctx, "无效的 Solana 签名格式")
			return
		}
	} else {
		if !isValidEthereumAddress(req.WalletAddress) {
			utils.BadRequest(ctx, "无效的钱包地址格式")
			return
		}
		if !isValidSignature(req.Signature) {
			utils.BadRequest(ctx, "无效的签名格式")
			return
		}
	}

	participant, token, err := c.participantService.VerifySignature(req.WalletAddress, req.Signature, req.WalletType)
	if err != nil {
		utils.BadRequest(ctx, err.Error())
		return
	}

	utils.Success(ctx, gin.H{
		"token": token,
		"participant": gin.H{
			"id":             participant.ID,
			"wallet_address": participant.WalletAddress,
			"wallet_type":    participant.WalletType,
			"nickname":       participant.Nickname,
		},
	})
}

// isValidEthereumAddress 验证以太坊地址格式
func isValidEthereumAddress(address string) bool {
	// 移除0x前缀
	addr := strings.TrimPrefix(strings.ToLower(address), "0x")
	
	// 检查长度（应该是40个十六进制字符）
	if len(addr) != 40 {
		return false
	}
	
	// 检查是否为有效的十六进制字符串
	matched, _ := regexp.MatchString("^[0-9a-f]{40}$", addr)
	if !matched {
		return false
	}
	
	// 使用go-ethereum库验证地址
	return common.IsHexAddress(address)
}

// isValidSignature 验证 EVM 签名格式
func isValidSignature(signature string) bool {
	sig := strings.TrimPrefix(signature, "0x")
	if len(sig) != 130 {
		return false
	}
	matched, _ := regexp.MatchString("^[0-9a-fA-F]{130}$", sig)
	return matched
}

// isValidSolanaSignature 验证 Solana/Ed25519 签名格式（base64，64 字节）
func isValidSolanaSignature(signature string) bool {
	sig := strings.TrimSpace(signature)
	if len(sig) == 0 {
		return false
	}
	dec, err := base64.StdEncoding.DecodeString(sig)
	return err == nil && len(dec) == 64
}

// GetProfile 获取当前参赛者信息
func (c *ArenaAuthController) GetProfile(ctx *gin.Context) {
	participantID, _ := ctx.Get("participant_id")
	participant, err := c.participantService.GetProfile(participantID.(uint64))
	if err != nil {
		utils.NotFound(ctx, "参赛者不存在")
		return
	}
	utils.Success(ctx, participant)
}

// UpdateProfile 更新当前参赛者信息
func (c *ArenaAuthController) UpdateProfile(ctx *gin.Context) {
	participantID, _ := ctx.Get("participant_id")

	var updates map[string]interface{}
	if err := ctx.ShouldBindJSON(&updates); err != nil {
		utils.BadRequest(ctx, "参数错误: "+err.Error())
		return
	}

	if err := c.participantService.UpdateProfile(participantID.(uint64), updates); err != nil {
		utils.BadRequest(ctx, err.Error())
		return
	}

	utils.Success(ctx, nil)
}

