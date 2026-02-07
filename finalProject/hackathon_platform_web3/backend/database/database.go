package database

import (
	"fmt"
	"log"

	"hackathon-backend/config"
	"hackathon-backend/models"

	"gorm.io/driver/mysql"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

var DB *gorm.DB

// InitDB 初始化数据库连接
func InitDB() error {
	cfg := config.AppConfig
	dsn := fmt.Sprintf("%s:%s@tcp(%s:%s)/%s?charset=utf8mb4&parseTime=True&loc=Local",
		cfg.DBUser,
		cfg.DBPassword,
		cfg.DBHost,
		cfg.DBPort,
		cfg.DBName,
	)

	var err error
	// 使用 Silent 避免迁移阶段大量 SQL 日志拖慢启动；正式跑请求时可按需在业务里设 LogMode
	logMode := logger.Info
	if config.AppConfig.ServerMode == "release" {
		logMode = logger.Error
	}
	DB, err = gorm.Open(mysql.Open(dsn), &gorm.Config{
		Logger:                   logger.Default.LogMode(logMode),
		PrepareStmt:              false, // 关闭可加快启动，多数 CRUD 场景影响很小
		DisableForeignKeyConstraintWhenMigrating: true, // 迁移时暂不建外键，加快迁移
	})

	if err != nil {
		return fmt.Errorf("failed to connect to database: %w", err)
	}

	log.Println("Database connected successfully")

	// 自动迁移（可通过 SKIP_AUTO_MIGRATE=true 或 config database.skip_auto_migrate 跳过以加快启动）
	if !config.AppConfig.SkipAutoMigrate {
		if err := AutoMigrate(); err != nil {
			return fmt.Errorf("failed to migrate database: %w", err)
		}
	} else {
		log.Println("AutoMigrate skipped (SKIP_AUTO_MIGRATE/skip_auto_migrate)")
	}

	return nil
}

// AutoMigrate 自动迁移数据库表
func AutoMigrate() error {
	return DB.AutoMigrate(
		&models.User{},
		&models.UserWallet{},
		&models.Participant{},
		&models.Hackathon{},
		&models.HackathonStage{},
		&models.HackathonAward{},
		&models.HackathonPrize{},
		&models.Registration{},
		&models.Checkin{},
		&models.Team{},
		&models.TeamMember{},
		&models.Submission{},
		&models.SubmissionHistory{},
		&models.Vote{},
		&models.SponsorApplication{},
		&models.Sponsor{},
		&models.HackathonSponsorEvent{},
	)
}

// CloseDB 关闭数据库连接
func CloseDB() error {
	sqlDB, err := DB.DB()
	if err != nil {
		return err
	}
	return sqlDB.Close()
}

