package services

import (
	"crypto/rand"
	"encoding/hex"
	"errors"
	"fmt"
	"regexp"
	"strings"
	"time"

	"hackathon-backend/config"
	"hackathon-backend/database"
	"hackathon-backend/models"
	"hackathon-backend/utils"

	"github.com/ethereum/go-ethereum/crypto"
	"gorm.io/gorm"
)

type ParticipantService struct{}

// GenerateNonce 生成随机nonce
func (s *ParticipantService) GenerateNonce() (string, error) {
	bytes := make([]byte, 32)
	if _, err := rand.Read(bytes); err != nil {
		return "", err
	}
	return hex.EncodeToString(bytes), nil
}

// ConnectWallet 连接钱包，获取nonce；walletType 可选，默认 metamask
func (s *ParticipantService) ConnectWallet(walletAddress, walletType string) (string, error) {
	if walletType == "" {
		walletType = "metamask"
	}
	if walletType != "metamask" && walletType != "phantom" {
		walletType = "metamask"
	}

	var participant models.Participant

	// 查找或创建参赛者
	err := database.DB.Where("wallet_address = ? AND deleted_at IS NULL", walletAddress).First(&participant).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		// 创建新参赛者
		participant = models.Participant{
			WalletAddress: walletAddress,
			WalletType:    walletType,
		}
		if err := database.DB.Create(&participant).Error; err != nil {
			return "", fmt.Errorf("创建参赛者失败: %w", err)
		}
	} else if err != nil {
		return "", err
	}

	// 生成nonce
	nonce, err := s.GenerateNonce()
	if err != nil {
		return "", fmt.Errorf("生成nonce失败: %w", err)
	}

	// 更新nonce
	participant.Nonce = nonce
	if err := database.DB.Save(&participant).Error; err != nil {
		return "", fmt.Errorf("更新nonce失败: %w", err)
	}

	return nonce, nil
}

// VerifySignature 验证签名并登录；walletType 可选，用于更新参赛者钱包类型
func (s *ParticipantService) VerifySignature(walletAddress, signature, walletType string) (*models.Participant, string, error) {
	if walletType == "" {
		walletType = "metamask"
	}
	if walletType != "metamask" && walletType != "phantom" {
		walletType = "metamask"
	}

	var participant models.Participant
	if err := database.DB.Where("wallet_address = ? AND deleted_at IS NULL", walletAddress).First(&participant).Error; err != nil {
		return nil, "", errors.New("钱包地址未注册")
	}

	if participant.Nonce == "" {
		return nil, "", errors.New("请先获取nonce")
	}

	// 按钱包类型验证签名
	if walletType == "phantom" {
		message := fmt.Sprintf("Please sign this message to authenticate: %s", participant.Nonce)
		if err := utils.VerifySolanaSignature(walletAddress, message, signature); err != nil {
			return nil, "", fmt.Errorf("签名验证失败: %w", err)
		}
	} else {
		isTestWallet := s.isTestWallet(walletAddress)
		if !isTestWallet {
			if err := s.verifyEthereumSignature(walletAddress, participant.Nonce, signature); err != nil {
				return nil, "", fmt.Errorf("签名验证失败: %w", err)
			}
		} else {
			if !s.isValidTestSignature(signature) {
				return nil, "", errors.New("测试钱包签名格式无效")
			}
		}
	}

	// 更新最后登录时间与钱包类型
	now := time.Now()
	participant.LastLoginAt = &now
	participant.WalletType = walletType
	participant.Nonce = "" // 清除nonce
	if err := database.DB.Save(&participant).Error; err != nil {
		return nil, "", fmt.Errorf("更新登录信息失败: %w", err)
	}

	// 生成token
	token, err := utils.GenerateParticipantToken(participant.ID, participant.WalletAddress)
	if err != nil {
		return nil, "", fmt.Errorf("生成token失败: %w", err)
	}

	return &participant, token, nil
}

// verifyEthereumSignature 验证以太坊签名
// 签名消息格式: "\x19Ethereum Signed Message:\n" + len(message) + message
// message = "Please sign this message to authenticate: {nonce}"
func (s *ParticipantService) verifyEthereumSignature(walletAddress, nonce, signature string) error {
	// 构建签名消息
	message := fmt.Sprintf("Please sign this message to authenticate: %s", nonce)
	messageHash := crypto.Keccak256Hash([]byte(fmt.Sprintf("\x19Ethereum Signed Message:\n%d%s", len(message), message)))

	// 移除0x前缀并解析签名
	sig := strings.TrimPrefix(signature, "0x")
	if len(sig) != 130 {
		return errors.New("签名格式错误")
	}

	sigBytes, err := hex.DecodeString(sig)
	if err != nil {
		return fmt.Errorf("解析签名失败: %w", err)
	}

	// 恢复公钥
	if sigBytes[64] != 27 && sigBytes[64] != 28 {
		return errors.New("签名恢复ID无效")
	}
	sigBytes[64] -= 27 // 转换为0或1

	recoveredPubKey, err := crypto.SigToPub(messageHash.Bytes(), sigBytes)
	if err != nil {
		return fmt.Errorf("恢复公钥失败: %w", err)
	}

	// 从公钥恢复地址
	recoveredAddress := crypto.PubkeyToAddress(*recoveredPubKey)

	// 验证地址是否匹配（不区分大小写）
	if !strings.EqualFold(recoveredAddress.Hex(), walletAddress) {
		return errors.New("签名地址不匹配")
	}

	return nil
}

// isTestWallet 检查钱包地址是否为测试钱包
func (s *ParticipantService) isTestWallet(walletAddress string) bool {
	if config.AppConfig == nil {
		return false
	}
	
	// 转换为小写进行比较（不区分大小写）
	addressLower := strings.ToLower(walletAddress)
	for _, testWallet := range config.AppConfig.TestWallets {
		if strings.ToLower(testWallet) == addressLower {
			return true
		}
	}
	return false
}

// isValidTestSignature 验证测试钱包签名格式（只验证格式，不验证内容）
func (s *ParticipantService) isValidTestSignature(signature string) bool {
	// 移除0x前缀
	sig := strings.TrimPrefix(signature, "0x")
	
	// 签名应该是130个十六进制字符（65字节 = 64字节签名 + 1字节恢复ID）
	if len(sig) != 130 {
		return false
	}
	
	// 检查是否为有效的十六进制字符串
	matched, _ := regexp.MatchString("^[0-9a-fA-F]{130}$", sig)
	return matched
}

// GetProfile 获取参赛者信息
func (s *ParticipantService) GetProfile(participantID uint64) (*models.Participant, error) {
	var participant models.Participant
	if err := database.DB.Where("id = ? AND deleted_at IS NULL", participantID).First(&participant).Error; err != nil {
		return nil, err
	}
	return &participant, nil
}

// UpdateProfile 更新参赛者信息
func (s *ParticipantService) UpdateProfile(participantID uint64, updates map[string]interface{}) error {
	// 不允许修改钱包地址与钱包类型
	if _, ok := updates["wallet_address"]; ok {
		return errors.New("不允许修改钱包地址")
	}
	if _, ok := updates["wallet_type"]; ok {
		return errors.New("不允许修改钱包类型")
	}

	return database.DB.Model(&models.Participant{}).Where("id = ? AND deleted_at IS NULL", participantID).Updates(updates).Error
}

