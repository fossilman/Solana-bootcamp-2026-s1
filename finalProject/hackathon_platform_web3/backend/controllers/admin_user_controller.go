package controllers

import (
	"strconv"

	"github.com/gin-gonic/gin"
	"hackathon-backend/models"
	"hackathon-backend/services"
	"hackathon-backend/utils"
)

type AdminUserController struct {
	userService *services.UserService
}

func NewAdminUserController() *AdminUserController {
	return &AdminUserController{
		userService: &services.UserService{},
	}
}

// CreateUser 创建用户
func (c *AdminUserController) CreateUser(ctx *gin.Context) {
	var req struct {
		Name      string  `json:"name" binding:"required"`
		Phone     string  `json:"phone" binding:"required"`
		Password  string  `json:"password" binding:"required,min=8"`
		Role      string  `json:"role" binding:"required"`
		SponsorID *uint64 `json:"sponsor_id"`
	}
	
	if err := ctx.ShouldBindJSON(&req); err != nil {
		utils.BadRequest(ctx, "参数错误: "+err.Error())
		return
	}

	// 验证角色
	if req.Role != "organizer" && req.Role != "sponsor" {
		utils.BadRequest(ctx, "角色只能是organizer或sponsor")
		return
	}

	// 创建用户对象
	user := models.User{
		Name:      req.Name,
		Phone:     req.Phone,
		Password:  req.Password, // 会在service中加密
		Role:      req.Role,
		SponsorID: req.SponsorID,
		Status:    1,
	}

	if err := c.userService.CreateUser(&user); err != nil {
		utils.BadRequest(ctx, err.Error())
		return
	}

	// 清除密码字段
	user.Password = ""
	utils.Success(ctx, user)
}

// GetUserList 获取用户列表
func (c *AdminUserController) GetUserList(ctx *gin.Context) {
	page, _ := strconv.Atoi(ctx.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(ctx.DefaultQuery("page_size", "10"))
	role := ctx.Query("role")
	keyword := ctx.Query("keyword")
	includeDeleted := ctx.Query("include_deleted") == "true"

	users, total, err := c.userService.GetUserList(page, pageSize, role, keyword, includeDeleted)
	if err != nil {
		utils.InternalServerError(ctx, err.Error())
		return
	}

	utils.SuccessWithPagination(ctx, users, page, pageSize, total)
}

// GetUserByID 获取用户详情
func (c *AdminUserController) GetUserByID(ctx *gin.Context) {
	id, err := strconv.ParseUint(ctx.Param("id"), 10, 64)
	if err != nil {
		utils.BadRequest(ctx, "无效的用户ID")
		return
	}

	user, err := c.userService.GetUserByID(id)
	if err != nil {
		utils.NotFound(ctx, "用户不存在")
		return
	}

	utils.Success(ctx, user)
}

// UpdateUser 更新用户
func (c *AdminUserController) UpdateUser(ctx *gin.Context) {
	id, err := strconv.ParseUint(ctx.Param("id"), 10, 64)
	if err != nil {
		utils.BadRequest(ctx, "无效的用户ID")
		return
	}

	var updates map[string]interface{}
	if err := ctx.ShouldBindJSON(&updates); err != nil {
		utils.BadRequest(ctx, "参数错误: "+err.Error())
		return
	}

	// 检查是否尝试修改不允许的字段
	if _, ok := updates["role"]; ok {
		utils.BadRequest(ctx, "不允许修改角色")
		return
	}
	if _, ok := updates["password"]; ok {
		utils.BadRequest(ctx, "密码需要单独处理")
		return
	}

	if len(updates) == 0 {
		utils.BadRequest(ctx, "没有可更新的字段")
		return
	}

	if err := c.userService.UpdateUser(id, updates); err != nil {
		utils.BadRequest(ctx, err.Error())
		return
	}

	utils.Success(ctx, nil)
}

// DeleteUser 删除用户
func (c *AdminUserController) DeleteUser(ctx *gin.Context) {
	id, err := strconv.ParseUint(ctx.Param("id"), 10, 64)
	if err != nil {
		utils.BadRequest(ctx, "无效的用户ID")
		return
	}

	if err := c.userService.DeleteUser(id); err != nil {
		utils.BadRequest(ctx, err.Error())
		return
	}

	utils.Success(ctx, nil)
}

// ResetPassword 重置用户密码（Admin权限）
func (c *AdminUserController) ResetPassword(ctx *gin.Context) {
	id, err := strconv.ParseUint(ctx.Param("id"), 10, 64)
	if err != nil {
		utils.BadRequest(ctx, "无效的用户ID")
		return
	}

	var req struct {
		Password string `json:"password" binding:"required,min=8"`
	}

	if err := ctx.ShouldBindJSON(&req); err != nil {
		utils.BadRequest(ctx, "参数错误: "+err.Error())
		return
	}

	if err := c.userService.ResetPassword(id, req.Password); err != nil {
		utils.BadRequest(ctx, err.Error())
		return
	}

	utils.Success(ctx, nil)
}

// RestoreUser 恢复已删除的用户
func (c *AdminUserController) RestoreUser(ctx *gin.Context) {
	id, err := strconv.ParseUint(ctx.Param("id"), 10, 64)
	if err != nil {
		utils.BadRequest(ctx, "无效的用户ID")
		return
	}

	if err := c.userService.RestoreUser(id); err != nil {
		utils.BadRequest(ctx, err.Error())
		return
	}

	utils.Success(ctx, nil)
}

