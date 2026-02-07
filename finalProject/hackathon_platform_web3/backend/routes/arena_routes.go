package routes

import (
	"hackathon-backend/controllers"
	"hackathon-backend/middleware"

	"github.com/gin-gonic/gin"
)

func SetupArenaRoutes(router *gin.Engine) {
	arenaAuthController := controllers.NewArenaAuthController()
	arenaHackathonController := controllers.NewArenaHackathonController()
	arenaRegistrationController := controllers.NewArenaRegistrationController()
	arenaTeamController := controllers.NewArenaTeamController()
	arenaSubmissionController := controllers.NewArenaSubmissionController()
	arenaVoteController := controllers.NewArenaVoteController()

	api := router.Group("/api/v1/arena")
	{
		// 认证相关（无需认证）
		auth := api.Group("/auth")
		{
			auth.POST("/connect", arenaAuthController.Connect)
			auth.POST("/verify", arenaAuthController.Verify)
		}

		// 活动相关（无需认证）
		hackathons := api.Group("/hackathons")
		{
			hackathons.GET("", arenaHackathonController.GetHackathonList)
			hackathons.GET("/:id", arenaHackathonController.GetHackathonByID)
			hackathons.GET("/archive", arenaHackathonController.GetArchiveList)
			hackathons.GET("/archive/:id", arenaHackathonController.GetArchiveDetail)
		}

		// 赞助商相关（无需认证）
		sponsorController := controllers.NewSponsorController()
		sponsors := api.Group("/sponsors")
		{
			sponsors.GET("/long-term", sponsorController.GetLongTermSponsors)
			sponsors.GET("/events/:id", sponsorController.GetEventSponsors)
		}

		// 需要认证的路由
		api.Use(middleware.ParticipantAuthMiddleware())
		{
			// 个人中心
			profile := api.Group("/profile")
			{
				profile.GET("", arenaAuthController.GetProfile)
				profile.PATCH("", arenaAuthController.UpdateProfile)
			}

			// 我的活动
			api.GET("/my-hackathons", arenaHackathonController.GetMyHackathons)

			// 报名相关
			registration := api.Group("/hackathons/:id")
			{
				registration.POST("/register", arenaRegistrationController.Register)
				registration.DELETE("/register", arenaRegistrationController.CancelRegistration)
				registration.GET("/registration-status", arenaRegistrationController.GetRegistrationStatus)
				registration.POST("/checkin", arenaRegistrationController.Checkin)
				registration.GET("/checkin-status", arenaRegistrationController.GetCheckinStatus)
			}

			// 组队相关
			teams := api.Group("/hackathons/:id/teams")
			{
				teams.POST("", arenaTeamController.CreateTeam)
				teams.GET("", arenaTeamController.GetTeamList)
				teams.GET("/my-team", arenaTeamController.GetUserTeam)
			}

			api.GET("/teams/:id", arenaTeamController.GetTeamByID)
			api.POST("/teams/:id/join", arenaTeamController.JoinTeam)
			api.POST("/teams/:id/leave", arenaTeamController.LeaveTeam)
			api.DELETE("/teams/:id", arenaTeamController.DissolveTeam)
			api.DELETE("/teams/:id/members/:member_id", arenaTeamController.RemoveMember)
			api.PATCH("/teams/:id", arenaTeamController.UpdateTeam)

			// 作品提交相关
			submissions := api.Group("/hackathons/:id/submissions")
			{
				submissions.POST("", arenaSubmissionController.CreateSubmission)
				submissions.GET("", arenaSubmissionController.GetSubmissionList)
			}

			api.GET("/submissions/:id", arenaSubmissionController.GetSubmissionByID)
			api.PUT("/submissions/:id", arenaSubmissionController.UpdateSubmission)
			api.GET("/submissions/:id/history", arenaSubmissionController.GetSubmissionHistory)

			// 投票相关
			api.POST("/submissions/:id/vote", arenaVoteController.Vote)
			api.DELETE("/submissions/:id/vote", arenaVoteController.CancelVote)
			api.GET("/hackathons/:id/votes", arenaVoteController.GetMyVotes)

			// 结果查看
			api.GET("/hackathons/:id/results", arenaVoteController.GetResults)
		}
	}
}

