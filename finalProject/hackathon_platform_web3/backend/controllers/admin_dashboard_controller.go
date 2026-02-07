package controllers

import (
	"github.com/gin-gonic/gin"
	"hackathon-backend/services"
	"hackathon-backend/utils"
)

type AdminDashboardController struct {
	dashboardService *services.DashboardService
}

func NewAdminDashboardController() *AdminDashboardController {
	return &AdminDashboardController{
		dashboardService: &services.DashboardService{},
	}
}

// GetDashboard 获取活动概览数据
func (c *AdminDashboardController) GetDashboard(ctx *gin.Context) {
	userID, _ := ctx.Get("user_id")
	role, _ := ctx.Get("role")

	dashboard, err := c.dashboardService.GetDashboard(userID.(uint64), role.(string))
	if err != nil {
		utils.InternalServerError(ctx, err.Error())
		return
	}

	utils.Success(ctx, dashboard)
}

