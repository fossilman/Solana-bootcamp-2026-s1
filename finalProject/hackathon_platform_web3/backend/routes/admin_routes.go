package routes

import (
	"hackathon-backend/controllers"
	"hackathon-backend/middleware"

	"github.com/gin-gonic/gin"
)

func SetupAdminRoutes(router *gin.Engine) {
	adminAuthController := controllers.NewAdminAuthController()
	adminUserController := controllers.NewAdminUserController()
	adminHackathonController := controllers.NewAdminHackathonController()
	adminDashboardController := controllers.NewAdminDashboardController()
	sponsorController := controllers.NewSponsorController()

	api := router.Group("/api/v1/admin")
	{
		// 认证相关（无需认证）
		auth := api.Group("/auth")
		{
			auth.POST("/login", adminAuthController.Login)
			auth.POST("/login/wallet", adminAuthController.LoginWithWallet)
			auth.POST("/logout", middleware.AuthMiddleware(), adminAuthController.Logout)
		}

		// 赞助商申请（无需认证）
		sponsor := api.Group("/sponsor")
		{
			sponsor.GET("/apply/prepare", sponsorController.PrepareSponsorApply)
			sponsor.POST("/applications", sponsorController.CreateApplication)
			sponsor.POST("/applications/submit-transaction", sponsorController.SubmitSponsorApplyTransaction)
			sponsor.GET("/applications/query", sponsorController.QueryApplication)
			sponsor.GET("/published-hackathons", sponsorController.GetPublishedHackathons)
		}

		// 需要认证的路由
		api.Use(middleware.AuthMiddleware())
		{
			// 人员管理（Admin权限）
			users := api.Group("/users")
			users.Use(middleware.RoleMiddleware("admin"))
			{
				users.POST("", adminUserController.CreateUser)
				users.GET("", adminUserController.GetUserList)
				users.GET("/:id", adminUserController.GetUserByID)
				users.PATCH("/:id", adminUserController.UpdateUser)
				users.DELETE("/:id", adminUserController.DeleteUser)
				users.POST("/:id/restore", adminUserController.RestoreUser)
				users.POST("/:id/reset-password", adminUserController.ResetPassword)
			}

			// 个人中心（所有角色）
			profile := api.Group("/profile")
			{
				profile.GET("", adminAuthController.GetProfile)
				profile.PATCH("", adminAuthController.UpdateProfile)
				profile.POST("/change-password", adminAuthController.ChangePassword)
				// 钱包地址管理
				profile.GET("/wallets", adminAuthController.GetWallets)
				profile.DELETE("/wallets/:id", adminAuthController.DeleteWallet)
			}

			// 活动概览（Organizer、Admin和Sponsor都可以）
			api.GET("/dashboard", middleware.RoleMiddleware("organizer", "admin", "sponsor"), adminDashboardController.GetDashboard)

			// 活动管理
			hackathons := api.Group("/hackathons")
			{
				// 查看活动列表和详情（Organizer和Admin都可以）
				hackathons.GET("", middleware.RoleMiddleware("organizer", "admin"), adminHackathonController.GetHackathonList)
				hackathons.GET("/:id", middleware.RoleMiddleware("organizer", "admin"), adminHackathonController.GetHackathonByID)
				hackathons.GET("/:id/stats", middleware.RoleMiddleware("organizer", "admin"), adminHackathonController.GetHackathonStats)
				hackathons.GET("/:id/stats/:type", middleware.RoleMiddleware("organizer", "admin"), adminHackathonController.GetHackathonStatsDetail)
				hackathons.GET("/:id/poster/qrcode", middleware.RoleMiddleware("organizer", "admin"), adminHackathonController.GetPosterQRCode)

				// 创建活动（仅Organizer）
				hackathons.POST("", middleware.RoleMiddleware("organizer"), adminHackathonController.CreateHackathon)

				// 编辑、删除、发布活动（仅Organizer，且仅活动创建者）
				hackathons.PUT("/:id", middleware.RoleMiddleware("organizer"), adminHackathonController.UpdateHackathon)
				hackathons.DELETE("/:id", middleware.RoleMiddleware("organizer"), adminHackathonController.DeleteHackathon)
				hackathons.GET("/:id/publish/prepare", middleware.RoleMiddleware("organizer"), adminHackathonController.PreparePublish)
				hackathons.POST("/:id/publish", middleware.RoleMiddleware("organizer"), adminHackathonController.PublishHackathon)
				hackathons.PATCH("/:id/chain-address", middleware.RoleMiddleware("organizer"), adminHackathonController.UpdateChainActivityAddress)

				// 阶段管理（仅Organizer，且仅活动创建者）
				hackathons.GET("/:id/stages/:stage/switch/prepare", middleware.RoleMiddleware("organizer"), adminHackathonController.PrepareSwitchStage)
				hackathons.POST("/:id/stages/:stage/switch", middleware.RoleMiddleware("organizer"), adminHackathonController.SwitchStage)
				hackathons.GET("/:id/stages", middleware.RoleMiddleware("organizer", "admin"), adminHackathonController.GetStageTimes)
				hackathons.PUT("/:id/stages", middleware.RoleMiddleware("organizer"), adminHackathonController.UpdateStageTimes)
				// 归档活动（Organizer和Admin都可以，但需检查权限）
				hackathons.POST("/:id/archive", middleware.RoleMiddleware("organizer", "admin"), adminHackathonController.ArchiveHackathon)
				hackathons.POST("/:id/unarchive", middleware.RoleMiddleware("organizer", "admin"), adminHackathonController.UnarchiveHackathon)
				hackathons.POST("/batch-archive", middleware.RoleMiddleware("organizer", "admin"), adminHackathonController.BatchArchiveHackathons)
			}

			// 赞助商审核（Admin权限）
			sponsorAdmin := api.Group("/sponsor")
			sponsorAdmin.Use(middleware.RoleMiddleware("admin"))
			{
				sponsorAdmin.GET("/review/prepare", sponsorController.PrepareSponsorReview)
				sponsorAdmin.GET("/applications/pending", sponsorController.GetPendingApplications)
				sponsorAdmin.GET("/applications/reviewed", sponsorController.GetReviewedApplications)
				sponsorAdmin.POST("/applications/:id/review", sponsorController.ReviewApplication)
			}
		}
	}
}

