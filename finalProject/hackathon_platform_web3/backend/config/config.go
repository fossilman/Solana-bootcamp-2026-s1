package config

import (
	"fmt"
	"os"
	"path/filepath"

	"github.com/joho/godotenv"
	"gopkg.in/yaml.v3"
)

type Config struct {
	DBHost          string   `yaml:"-"` // 不从YAML直接读取，从database子结构读取
	DBPort          string   `yaml:"-"`
	DBUser          string   `yaml:"-"`
	DBPassword      string   `yaml:"-"`
	DBName          string   `yaml:"-"`
	SkipAutoMigrate bool     `yaml:"-"` // 为 true 时启动跳过自动迁移，加快启动（表已就绪时使用）
	JWTSecret       string   `yaml:"-"`
	JWTExpireHours  int      `yaml:"-"`
	ServerPort      string   `yaml:"-"`
	ServerMode      string   `yaml:"-"`
	CORSOrigins     []string `yaml:"-"`
	TestWallets     []string `yaml:"-"` // 测试钱包地址列表

	// YAML配置结构
	Database struct {
		Host            string `yaml:"host"`
		Port            string `yaml:"port"`
		User            string `yaml:"user"`
		Password        string `yaml:"password"`
		Name            string `yaml:"name"`
		SkipAutoMigrate bool   `yaml:"skip_auto_migrate"` // 启动时跳过自动迁移
	} `yaml:"database"`
	JWT struct {
		Secret      string `yaml:"secret"`
		ExpireHours int    `yaml:"expire_hours"`
	} `yaml:"jwt"`
	Server struct {
		Port string `yaml:"port"`
		Mode string `yaml:"mode"`
	} `yaml:"server"`
	CORS struct {
		AllowOrigins []string `yaml:"allow_origins"`
	} `yaml:"cors"`
	Solana struct {
		ProgramID             string `yaml:"program_id"`
		RPCURL                string `yaml:"rpc_url"`
		AuthorityKey          string `yaml:"authority_key"`             // Admin 账户私钥（Base58）。链上 sponsor config 的 authority 唯一，仅此账户可审核赞助；用于自动初始化；环境变量 SOLANA_AUTHORITY_KEY
		SponsorAdminWallet    string `yaml:"sponsor_admin_wallet"`     // 审核通过时收款地址，须与链上 config.admin_wallet 一致。可填 Admin 钱包或平台指定主办方收款地址（链上仅一个）；环境变量 SOLANA_SPONSOR_ADMIN_WALLET
		SponsorReviewPeriodSecs int `yaml:"sponsor_review_period_secs"` // 赞助审核期限（秒），默认 10800（3 小时）；自动初始化时写入链上
	} `yaml:"solana"`
}

var AppConfig *Config

// LoadConfig 加载配置文件
// 优先级：config.yaml > .env > 默认值
func LoadConfig() error {
	// 默认配置
	defaultConfig := &Config{
		DBHost:         "localhost",
		DBPort:         "3306",
		DBUser:         "root",
		DBPassword:     "password",
		DBName:         "hackathon_db",
		JWTSecret:      "your-secret-key-change-in-production",
		JWTExpireHours: 24,
		ServerPort:     "8000",
		ServerMode:     "debug",
		CORSOrigins:    []string{"http://localhost:3000", "http://localhost:3001"},
		TestWallets: []string{
			"0x1111111111111111111111111111111111111111",
			"0x2222222222222222222222222222222222222222",
			"0x3333333333333333333333333333333333333333",
			"0x4444444444444444444444444444444444444444",
			"0x5555555555555555555555555555555555555555",
		},
	}

	// 尝试从YAML配置文件加载
	configFile := "config.yaml"
	if _, err := os.Stat(configFile); err == nil {
		if err := loadFromYAML(configFile, defaultConfig); err != nil {
			return fmt.Errorf("加载配置文件失败: %w", err)
		}
	}

	// 尝试加载.env文件（如果存在），用于覆盖配置
	_ = godotenv.Load()

	// 从环境变量覆盖配置（如果设置了环境变量）
	testWallets := defaultConfig.TestWallets
	if envWallets := getEnv("TEST_WALLETS", ""); envWallets != "" {
		testWallets = getEnvAsSlice("TEST_WALLETS", defaultConfig.TestWallets)
	}

	AppConfig = &Config{
		DBHost:          getEnv("DB_HOST", defaultConfig.DBHost),
		DBPort:          getEnv("DB_PORT", defaultConfig.DBPort),
		DBUser:          getEnv("DB_USER", defaultConfig.DBUser),
		DBPassword:      getEnv("DB_PASSWORD", defaultConfig.DBPassword),
		DBName:          getEnv("DB_NAME", defaultConfig.DBName),
		SkipAutoMigrate: getEnvAsBool("SKIP_AUTO_MIGRATE", defaultConfig.SkipAutoMigrate),
		JWTSecret:       getEnv("JWT_SECRET", defaultConfig.JWTSecret),
		JWTExpireHours: getEnvAsInt("JWT_EXPIRE_HOURS", defaultConfig.JWTExpireHours),
		ServerPort:     getEnv("SERVER_PORT", defaultConfig.ServerPort),
		ServerMode:     getEnv("SERVER_MODE", defaultConfig.ServerMode),
		CORSOrigins:    getEnvAsSlice("CORS_ALLOW_ORIGINS", defaultConfig.CORSOrigins),
		TestWallets: testWallets,
		Solana: struct {
			ProgramID                string `yaml:"program_id"`
			RPCURL                   string `yaml:"rpc_url"`
			AuthorityKey             string `yaml:"authority_key"`
			SponsorAdminWallet       string `yaml:"sponsor_admin_wallet"`
			SponsorReviewPeriodSecs  int    `yaml:"sponsor_review_period_secs"`
		}{
			ProgramID:               getEnv("SOLANA_PROGRAM_ID", defaultConfig.Solana.ProgramID),
			RPCURL:                  getEnv("SOLANA_RPC_URL", defaultConfig.Solana.RPCURL),
			AuthorityKey:            getEnv("SOLANA_AUTHORITY_KEY", defaultConfig.Solana.AuthorityKey),
			SponsorAdminWallet:      getEnv("SOLANA_SPONSOR_ADMIN_WALLET", defaultConfig.Solana.SponsorAdminWallet),
			SponsorReviewPeriodSecs: getEnvAsInt("SOLANA_SPONSOR_REVIEW_PERIOD_SECS", defaultConfig.Solana.SponsorReviewPeriodSecs),
		},
	}

	return nil
}

// loadFromYAML 从YAML文件加载配置
func loadFromYAML(filename string, defaultConfig *Config) error {
	data, err := os.ReadFile(filename)
	if err != nil {
		return err
	}

	var yamlConfig Config
	if err := yaml.Unmarshal(data, &yamlConfig); err != nil {
		return fmt.Errorf("解析YAML配置失败: %w", err)
	}

	// 合并配置（YAML中的值覆盖默认值）
	if yamlConfig.Database.Host != "" {
		defaultConfig.DBHost = yamlConfig.Database.Host
	}
	if yamlConfig.Database.Port != "" {
		defaultConfig.DBPort = yamlConfig.Database.Port
	}
	if yamlConfig.Database.User != "" {
		defaultConfig.DBUser = yamlConfig.Database.User
	}
	if yamlConfig.Database.Password != "" {
		defaultConfig.DBPassword = yamlConfig.Database.Password
	}
	if yamlConfig.Database.Name != "" {
		defaultConfig.DBName = yamlConfig.Database.Name
	}
	if yamlConfig.Database.SkipAutoMigrate {
		defaultConfig.SkipAutoMigrate = true
	}
	if yamlConfig.JWT.Secret != "" {
		defaultConfig.JWTSecret = yamlConfig.JWT.Secret
	}
	if yamlConfig.JWT.ExpireHours > 0 {
		defaultConfig.JWTExpireHours = yamlConfig.JWT.ExpireHours
	}
	if yamlConfig.Server.Port != "" {
		defaultConfig.ServerPort = yamlConfig.Server.Port
	}
	if yamlConfig.Server.Mode != "" {
		defaultConfig.ServerMode = yamlConfig.Server.Mode
	}
	if len(yamlConfig.CORS.AllowOrigins) > 0 {
		defaultConfig.CORSOrigins = yamlConfig.CORS.AllowOrigins
	}
	if yamlConfig.Solana.ProgramID != "" {
		defaultConfig.Solana.ProgramID = yamlConfig.Solana.ProgramID
	}
	if yamlConfig.Solana.RPCURL != "" {
		defaultConfig.Solana.RPCURL = yamlConfig.Solana.RPCURL
	}
	if yamlConfig.Solana.AuthorityKey != "" {
		defaultConfig.Solana.AuthorityKey = yamlConfig.Solana.AuthorityKey
	}
	if yamlConfig.Solana.SponsorAdminWallet != "" {
		defaultConfig.Solana.SponsorAdminWallet = yamlConfig.Solana.SponsorAdminWallet
	}
	if yamlConfig.Solana.SponsorReviewPeriodSecs > 0 {
		defaultConfig.Solana.SponsorReviewPeriodSecs = yamlConfig.Solana.SponsorReviewPeriodSecs
	}

	return nil
}

// LoadConfigFromPath 从指定路径加载配置文件
func LoadConfigFromPath(configPath string) error {
	// 获取配置文件所在目录
	configDir := filepath.Dir(configPath)
	if configDir == "." {
		configDir, _ = os.Getwd()
	}

	// 切换到配置文件所在目录
	originalDir, _ := os.Getwd()
	defer os.Chdir(originalDir)
	os.Chdir(configDir)

	// 加载配置
	return LoadConfig()
}

func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

func getEnvAsInt(key string, defaultValue int) int {
	if value := os.Getenv(key); value != "" {
		var result int
		if _, err := fmt.Sscanf(value, "%d", &result); err == nil {
			return result
		}
	}
	return defaultValue
}

func getEnvAsBool(key string, defaultValue bool) bool {
	if value := os.Getenv(key); value != "" {
		switch value {
		case "1", "true", "TRUE", "yes", "on":
			return true
		case "0", "false", "FALSE", "no", "off":
			return false
		}
	}
	return defaultValue
}

func getEnvAsSlice(key string, defaultValue []string) []string {
	if value := os.Getenv(key); value != "" {
		// 简单的逗号分隔处理
		var result []string
		start := 0
		for i, char := range value {
			if char == ',' {
				if i > start {
					result = append(result, value[start:i])
				}
				start = i + 1
			}
		}
		if start < len(value) {
			result = append(result, value[start:])
		}
		if len(result) > 0 {
			return result
		}
	}
	return defaultValue
}
