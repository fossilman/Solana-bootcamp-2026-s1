package services

import (
	"errors"
	"fmt"

	"hackathon-backend/database"
	"hackathon-backend/models"
	"hackathon-backend/utils"

	"gorm.io/gorm"
)

type UserService struct{}

// Login 用户登录（手机号+密码）
func (s *UserService) Login(phone, password string) (*models.User, string, error) {
	var user models.User
	if err := database.DB.Where("phone = ? AND deleted_at IS NULL", phone).First(&user).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, "", errors.New("账号不存在")
		}
		return nil, "", err
	}

	if user.Status == 0 {
		return nil, "", errors.New("账号已被禁用")
	}

	if user.Password == "" {
		return nil, "", errors.New("该账号未设置密码，请使用钱包登录")
	}

	if !utils.CheckPassword(password, user.Password) {
		return nil, "", errors.New("密码错误")
	}

	token, err := utils.GenerateToken(user.ID, user.Phone, user.Role)
	if err != nil {
		return nil, "", fmt.Errorf("生成token失败: %w", err)
	}

	return &user, token, nil
}

// LoginWithWallet Web3钱包登录（需要手机号）
func (s *UserService) LoginWithWallet(walletAddress, phone, walletType string) (*models.User, string, error) {
	if walletType == "" {
		walletType = "metamask"
	}
	if walletType != "metamask" && walletType != "phantom" {
		walletType = "metamask"
	}

	// 先根据手机号查找用户
	var user models.User
	if err := database.DB.Where("phone = ? AND deleted_at IS NULL", phone).First(&user).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, "", errors.New("手机号不存在")
		}
		return nil, "", err
	}

	if user.Status == 0 {
		return nil, "", errors.New("账号已被禁用")
	}

	// 检查钱包地址是否已绑定给其他用户
	var existingWallet models.UserWallet
	if err := database.DB.Where("address = ?", walletAddress).First(&existingWallet).Error; err == nil {
		// 钱包地址已存在
		if existingWallet.UserID != user.ID {
			return nil, "", errors.New("钱包地址已被其他用户绑定")
		}
		// 更新钱包类型（可选，保持最新）
		database.DB.Model(&existingWallet).Update("wallet_type", walletType)
	} else if errors.Is(err, gorm.ErrRecordNotFound) {
		// 钱包地址未绑定，创建绑定关系
		wallet := models.UserWallet{
			UserID:     user.ID,
			Address:    walletAddress,
			WalletType: walletType,
		}
		if err := database.DB.Create(&wallet).Error; err != nil {
			return nil, "", fmt.Errorf("绑定钱包地址失败: %w", err)
		}
	} else {
		return nil, "", err
	}

	token, err := utils.GenerateWalletToken(user.ID, walletAddress, user.Role)
	if err != nil {
		return nil, "", fmt.Errorf("生成token失败: %w", err)
	}

	return &user, token, nil
}

// BindWallet 绑定钱包地址，walletType 可选，默认 metamask
func (s *UserService) BindWallet(userID uint64, walletAddress, walletType string) error {
	if walletType == "" {
		walletType = "metamask"
	}
	if walletType != "metamask" && walletType != "phantom" {
		walletType = "metamask"
	}

	// 检查钱包地址是否已被绑定
	var existingWallet models.UserWallet
	if err := database.DB.Where("address = ?", walletAddress).First(&existingWallet).Error; err == nil {
		return errors.New("钱包地址已被绑定")
	}

	// 检查用户是否存在
	var user models.User
	if err := database.DB.Where("id = ? AND deleted_at IS NULL", userID).First(&user).Error; err != nil {
		return errors.New("用户不存在")
	}

	// 创建钱包记录
	wallet := models.UserWallet{
		UserID:     userID,
		Address:    walletAddress,
		WalletType: walletType,
	}

	if err := database.DB.Create(&wallet).Error; err != nil {
		return fmt.Errorf("绑定钱包失败: %w", err)
	}

	return nil
}

// GetUserWallets 获取用户的钱包地址列表
func (s *UserService) GetUserWallets(userID uint64) ([]models.UserWallet, error) {
	var wallets []models.UserWallet
	if err := database.DB.Where("user_id = ?", userID).Find(&wallets).Error; err != nil {
		return nil, err
	}
	return wallets, nil
}

// UnbindWallet 解绑钱包地址
func (s *UserService) UnbindWallet(userID, walletID uint64) error {
	// 检查钱包是否属于当前用户
	var wallet models.UserWallet
	if err := database.DB.Where("id = ? AND user_id = ?", walletID, userID).First(&wallet).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return errors.New("钱包地址不存在或不属于当前用户")
		}
		return err
	}

	// 删除钱包记录
	if err := database.DB.Delete(&wallet).Error; err != nil {
		return fmt.Errorf("解绑钱包失败: %w", err)
	}

	return nil
}

// CreateUser 创建用户（Admin权限）
func (s *UserService) CreateUser(user *models.User) error {
	// 检查手机号是否已存在（如果提供了手机号）
	if user.Phone != "" {
		var existingUser models.User
		if err := database.DB.Where("phone = ? AND deleted_at IS NULL", user.Phone).First(&existingUser).Error; err == nil {
			return errors.New("手机号已存在")
		}
	}

	// 加密密码（如果提供了密码）
	if user.Password != "" {
		hashedPassword, err := utils.HashPassword(user.Password)
		if err != nil {
			return fmt.Errorf("密码加密失败: %w", err)
		}
		user.Password = hashedPassword
	}

	if err := database.DB.Create(user).Error; err != nil {
		return fmt.Errorf("创建用户失败: %w", err)
	}

	// 清除密码字段
	user.Password = ""

	return nil
}

// GetUserList 获取用户列表（包括已禁用的用户）
func (s *UserService) GetUserList(page, pageSize int, role, keyword string, includeDeleted bool) ([]models.User, int64, error) {
	var users []models.User
	var total int64

	// 查询未软删除的用户（deleted_at IS NULL）
	query := database.DB.Model(&models.User{}).Where("deleted_at IS NULL")

	// 如果不需要包含已禁用的用户，过滤掉 status = 0 的用户
	if !includeDeleted {
		query = query.Where("status = ?", 1)
	}

	if role != "" {
		query = query.Where("role = ?", role)
	}

	if keyword != "" {
		query = query.Where("name LIKE ? OR phone LIKE ?", "%"+keyword+"%", "%"+keyword+"%")
	}

	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	offset := (page - 1) * pageSize
	if err := query.Offset(offset).Limit(pageSize).Find(&users).Error; err != nil {
		return nil, 0, err
	}

	// 清除密码字段
	for i := range users {
		users[i].Password = ""
	}

	return users, total, nil
}

// GetUserByID 根据ID获取用户
func (s *UserService) GetUserByID(id uint64) (*models.User, error) {
	var user models.User
	if err := database.DB.Where("id = ? AND deleted_at IS NULL", id).First(&user).Error; err != nil {
		return nil, err
	}

	user.Password = ""
	return &user, nil
}

// UpdateUser 更新用户信息
func (s *UserService) UpdateUser(id uint64, updates map[string]interface{}) error {
	// 不允许修改角色
	if _, ok := updates["role"]; ok {
		return errors.New("不允许修改角色")
	}
	if _, ok := updates["password"]; ok {
		return errors.New("密码需要单独处理")
	}

	if len(updates) == 0 {
		return errors.New("没有可更新的字段")
	}

	return database.DB.Model(&models.User{}).Where("id = ? AND deleted_at IS NULL", id).Updates(updates).Error
}

// DeleteUser 禁用用户（设置status为0）
func (s *UserService) DeleteUser(id uint64) error {
	// 使用原生 SQL 确保零值能正确更新
	result := database.DB.Exec("UPDATE users SET status = ? WHERE id = ? AND deleted_at IS NULL", 0, id)
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return errors.New("用户不存在或已被删除")
	}
	return nil
}

// RestoreUser 恢复已禁用的用户（设置status为1）
func (s *UserService) RestoreUser(id uint64) error {
	// 使用原生 SQL 确保更新能正确执行
	result := database.DB.Exec("UPDATE users SET status = ? WHERE id = ? AND deleted_at IS NULL", 1, id)
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return errors.New("用户不存在或已被删除")
	}
	return nil
}

// ResetPassword 重置用户密码（Admin权限）
func (s *UserService) ResetPassword(id uint64, newPassword string) error {
	// 检查用户是否存在
	var user models.User
	if err := database.DB.Where("id = ? AND deleted_at IS NULL", id).First(&user).Error; err != nil {
		return errors.New("用户不存在")
	}

	// 加密新密码
	hashedPassword, err := utils.HashPassword(newPassword)
	if err != nil {
		return fmt.Errorf("密码加密失败: %w", err)
	}

	// 更新密码
	return database.DB.Model(&models.User{}).Where("id = ?", id).Update("password", hashedPassword).Error
}

// UpdatePassword 更新当前用户密码
func (s *UserService) UpdatePassword(userID uint64, oldPassword, newPassword string) error {
	var user models.User
	if err := database.DB.Where("id = ? AND deleted_at IS NULL", userID).First(&user).Error; err != nil {
		return errors.New("用户不存在")
	}

	// 验证旧密码
	if !utils.CheckPassword(oldPassword, user.Password) {
		return errors.New("原密码错误")
	}

	// 加密新密码
	hashedPassword, err := utils.HashPassword(newPassword)
	if err != nil {
		return fmt.Errorf("密码加密失败: %w", err)
	}

	// 更新密码
	return database.DB.Model(&models.User{}).Where("id = ?", userID).Update("password", hashedPassword).Error
}

// GetCurrentUser 获取当前用户信息
func (s *UserService) GetCurrentUser(userID uint64) (*models.User, error) {
	return s.GetUserByID(userID)
}

// UpdateCurrentUser 更新当前用户信息
func (s *UserService) UpdateCurrentUser(userID uint64, updates map[string]interface{}) error {
	// 不允许修改角色
	if _, ok := updates["role"]; ok {
		return errors.New("不允许修改角色")
	}
	if _, ok := updates["password"]; ok {
		return errors.New("密码需要单独处理")
	}

	if len(updates) == 0 {
		return errors.New("没有可更新的字段")
	}

	return database.DB.Model(&models.User{}).Where("id = ? AND deleted_at IS NULL", userID).Updates(updates).Error
}
