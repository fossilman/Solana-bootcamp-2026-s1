package services

import (
	"crypto/sha256"
	"errors"
	"fmt"
	"strings"
	"time"

	"hackathon-backend/database"
	"hackathon-backend/models"
	"hackathon-backend/solana"
	"hackathon-backend/utils"

	"gorm.io/gorm"
)

type HackathonService struct{}

// CreateHackathon 创建活动
func (s *HackathonService) CreateHackathon(hackathon *models.Hackathon, stages []models.HackathonStage, awards []models.HackathonAward, autoAssignStages bool) error {
	return database.DB.Transaction(func(tx *gorm.DB) error {
		// 创建活动
		if err := tx.Create(hackathon).Error; err != nil {
			return fmt.Errorf("创建活动失败: %w", err)
		}

		// 如果启用自动分配阶段时间，且未提供阶段数据，则自动分配
		if autoAssignStages && len(stages) == 0 {
			stages = s.autoAssignStageTimes(hackathon.StartTime, hackathon.EndTime)
		}

		// 创建阶段
		for i := range stages {
			stages[i].HackathonID = hackathon.ID
			if err := tx.Create(&stages[i]).Error; err != nil {
				return fmt.Errorf("创建阶段失败: %w", err)
			}
		}

		// 创建奖项
		for i := range awards {
			awards[i].HackathonID = hackathon.ID
			if err := tx.Create(&awards[i]).Error; err != nil {
				return fmt.Errorf("创建奖项失败: %w", err)
			}
		}

		return nil
	})
}

// autoAssignStageTimes 自动分配各阶段时间
func (s *HackathonService) autoAssignStageTimes(startTime, endTime time.Time) []models.HackathonStage {
	stages := make([]models.HackathonStage, 0)

	// 计算各阶段时间
	// 报名阶段：活动开始时间 ~ 活动开始时间 + 7天
	registrationStart := startTime
	registrationEnd := startTime.AddDate(0, 0, 7)

	// 签到阶段：报名阶段结束时间 ~ 报名阶段结束时间 + 1天
	checkinStart := registrationEnd
	checkinEnd := registrationEnd.AddDate(0, 0, 1)

	// 组队阶段：签到阶段结束时间 ~ 签到阶段结束时间 + 3天
	teamFormationStart := checkinEnd
	teamFormationEnd := checkinEnd.AddDate(0, 0, 3)

	// 提交阶段：组队阶段结束时间 ~ 活动结束时间前 2天
	submissionStart := teamFormationEnd
	submissionEnd := endTime.AddDate(0, 0, -2)

	// 投票阶段：提交阶段结束时间 ~ 活动结束时间前 1天
	votingStart := submissionEnd
	votingEnd := endTime.AddDate(0, 0, -1)

	// 确保时间不超出活动范围
	if submissionEnd.After(endTime) {
		submissionEnd = endTime.AddDate(0, 0, -2)
	}
	if votingEnd.After(endTime) {
		votingEnd = endTime.AddDate(0, 0, -1)
	}

	// 创建阶段记录
	stages = append(stages, models.HackathonStage{
		Stage:     "registration",
		StartTime: registrationStart,
		EndTime:   registrationEnd,
	})
	stages = append(stages, models.HackathonStage{
		Stage:     "checkin",
		StartTime: checkinStart,
		EndTime:   checkinEnd,
	})
	stages = append(stages, models.HackathonStage{
		Stage:     "team_formation",
		StartTime: teamFormationStart,
		EndTime:   teamFormationEnd,
	})
	stages = append(stages, models.HackathonStage{
		Stage:     "submission",
		StartTime: submissionStart,
		EndTime:   submissionEnd,
	})
	stages = append(stages, models.HackathonStage{
		Stage:     "voting",
		StartTime: votingStart,
		EndTime:   votingEnd,
	})

	return stages
}

// GetHackathonList 获取活动列表
// 根据权限矩阵：所有主办方可以看到所有活动，但只能编辑、删除、发布自己创建的活动
func (s *HackathonService) GetHackathonList(page, pageSize int, status, keyword, sort string, organizerID *uint64) ([]models.Hackathon, int64, error) {
	var hackathons []models.Hackathon
	var total int64

	query := database.DB.Model(&models.Hackathon{}).Where("deleted_at IS NULL")

	// 移除organizerID过滤，让所有主办方可以看到所有活动
	// 权限矩阵要求：所有主办方可以看到所有活动

	if status != "" {
		query = query.Where("status = ?", status)
	}

	if keyword != "" {
		query = query.Where("name LIKE ?", "%"+keyword+"%")
	}

	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	// 排序
	switch sort {
	case "created_at_asc":
		query = query.Order("created_at ASC")
	case "created_at_desc":
		query = query.Order("created_at DESC")
	case "start_time_asc":
		query = query.Order("start_time ASC")
	case "start_time_desc":
		query = query.Order("start_time DESC")
	case "end_time_asc":
		query = query.Order("end_time ASC")
	case "end_time_desc":
		query = query.Order("end_time DESC")
	default:
		query = query.Order("created_at DESC")
	}

	offset := (page - 1) * pageSize
	if err := query.Offset(offset).Limit(pageSize).Find(&hackathons).Error; err != nil {
		return nil, 0, err
	}

	// 为有链上活动地址的项填充签到信息上链地址（check_ins PDA），供活动卡片展示
	s.enrichChainCheckInsAddress(&hackathons)
	return hackathons, total, nil
}

// enrichChainCheckInsAddress 根据 program_id 与 chain_activity_address 推导并填充 chain_check_ins_address、chain_vote_tally_address
func (s *HackathonService) enrichChainCheckInsAddress(hackathons *[]models.Hackathon) {
	if hackathons == nil || len(*hackathons) == 0 {
		return
	}
	programID, _, err := solana.PreparePublishConfig()
	if err != nil {
		return
	}
	for i := range *hackathons {
		addr := strings.TrimSpace((*hackathons)[i].ChainActivityAddress)
		if addr == "" {
			continue
		}
		if pda, err := solana.CheckInsPDA(programID, addr); err == nil {
			(*hackathons)[i].ChainCheckInsAddress = pda.String()
		}
		if pda, err := solana.VoteTallyPDA(programID, addr); err == nil {
			(*hackathons)[i].ChainVoteTallyAddress = pda.String()
		}
	}
}

// GetHackathonByID 根据ID获取活动详情
func (s *HackathonService) GetHackathonByID(id uint64) (*models.Hackathon, error) {
	var hackathon models.Hackathon
	if err := database.DB.Preload("Stages").Preload("Awards").Where("id = ? AND deleted_at IS NULL", id).First(&hackathon).Error; err != nil {
		return nil, err
	}

	// 详情页展示签到信息上链地址
	list := []models.Hackathon{hackathon}
	s.enrichChainCheckInsAddress(&list)
	return &list[0], nil
}

// GetHackathonStats 获取活动统计信息
func (s *HackathonService) GetHackathonStats(id uint64) (map[string]interface{}, error) {
	stats := make(map[string]interface{})

	var registrationCount, checkinCount, teamCount, submissionCount, voteCount int64
	database.DB.Model(&models.Registration{}).Where("hackathon_id = ?", id).Count(&registrationCount)
	database.DB.Model(&models.Checkin{}).Where("hackathon_id = ?", id).Count(&checkinCount)
	database.DB.Model(&models.Team{}).Where("hackathon_id = ? AND deleted_at IS NULL", id).Count(&teamCount)
	database.DB.Model(&models.Submission{}).Where("hackathon_id = ? AND draft = 0", id).Count(&submissionCount)
	database.DB.Model(&models.Vote{}).Where("hackathon_id = ?", id).Count(&voteCount)

	stats["registration_count"] = registrationCount
	stats["checkin_count"] = checkinCount
	stats["team_count"] = teamCount
	stats["submission_count"] = submissionCount
	stats["vote_count"] = voteCount

	return stats, nil
}

// GetHackathonStatsDetail 获取活动统计详情
func (s *HackathonService) GetHackathonStatsDetail(hackathonID uint64, statsType string, page, pageSize int, keyword string) ([]map[string]interface{}, int64, error) {
	var list []map[string]interface{}
	var total int64

	switch statsType {
	case "registrations":
		// 报名人数详情
		query := database.DB.Model(&models.Registration{}).
			Joins("INNER JOIN participants ON participants.id = registrations.participant_id").
			Where("registrations.hackathon_id = ?", hackathonID)

		if keyword != "" {
			query = query.Where("participants.nickname LIKE ? OR participants.wallet_address LIKE ?", "%"+keyword+"%", "%"+keyword+"%")
		}

		if err := query.Count(&total).Error; err != nil {
			return nil, 0, err
		}

		var registrations []struct {
			models.Registration
			Nickname      string    `json:"nickname"`
			WalletAddress string    `json:"wallet_address"`
			CreatedAt     time.Time `json:"created_at"`
		}

		offset := (page - 1) * pageSize
		if err := query.Select("registrations.*, participants.nickname, participants.wallet_address, registrations.created_at").
			Offset(offset).Limit(pageSize).Order("registrations.created_at DESC").Find(&registrations).Error; err != nil {
			return nil, 0, err
		}

		for _, r := range registrations {
			list = append(list, map[string]interface{}{
				"nickname":       r.Nickname,
				"wallet_address": r.WalletAddress,
				"created_at":     r.CreatedAt,
			})
		}

	case "checkins":
		// 签到人数详情
		query := database.DB.Model(&models.Checkin{}).
			Joins("INNER JOIN participants ON participants.id = checkins.participant_id").
			Where("checkins.hackathon_id = ?", hackathonID)

		if keyword != "" {
			query = query.Where("participants.nickname LIKE ? OR participants.wallet_address LIKE ?", "%"+keyword+"%", "%"+keyword+"%")
		}

		if err := query.Count(&total).Error; err != nil {
			return nil, 0, err
		}

		var checkins []struct {
			models.Checkin
			Nickname      string    `json:"nickname"`
			WalletAddress string    `json:"wallet_address"`
			CreatedAt     time.Time `json:"created_at"`
		}

		offset := (page - 1) * pageSize
		if err := query.Select("checkins.*, participants.nickname, participants.wallet_address, checkins.created_at").
			Offset(offset).Limit(pageSize).Order("checkins.created_at DESC").Find(&checkins).Error; err != nil {
			return nil, 0, err
		}

		for _, c := range checkins {
			list = append(list, map[string]interface{}{
				"nickname":       c.Nickname,
				"wallet_address": c.WalletAddress,
				"created_at":     c.CreatedAt,
			})
		}

	case "teams":
		// 队伍数量详情
		query := database.DB.Model(&models.Team{}).
			Where("hackathon_id = ? AND deleted_at IS NULL", hackathonID)

		if keyword != "" {
			query = query.Where("name LIKE ?", "%"+keyword+"%")
		}

		if err := query.Count(&total).Error; err != nil {
			return nil, 0, err
		}

		var teams []models.Team
		offset := (page - 1) * pageSize
		if err := query.Preload("Leader").Preload("Members").
			Offset(offset).Limit(pageSize).Order("created_at DESC").Find(&teams).Error; err != nil {
			return nil, 0, err
		}

		for _, t := range teams {
			leaderName := ""
			if t.Leader.Nickname != "" {
				leaderName = t.Leader.Nickname
			} else if len(t.Leader.WalletAddress) >= 8 {
				leaderName = t.Leader.WalletAddress[:8] + "..."
			}
			list = append(list, map[string]interface{}{
				"team_name":    t.Name,
				"leader":       leaderName,
				"member_count": len(t.Members),
				"created_at":   t.CreatedAt,
			})
		}

	case "submissions":
		// 作品数量详情
		query := database.DB.Model(&models.Submission{}).
			Joins("INNER JOIN teams ON teams.id = submissions.team_id").
			Where("submissions.hackathon_id = ? AND submissions.draft = 0", hackathonID)

		if keyword != "" {
			query = query.Where("submissions.name LIKE ? OR teams.name LIKE ?", "%"+keyword+"%", "%"+keyword+"%")
		}

		if err := query.Count(&total).Error; err != nil {
			return nil, 0, err
		}

		var submissions []models.Submission
		offset := (page - 1) * pageSize
		if err := query.Preload("Team").
			Offset(offset).Limit(pageSize).Order("created_at DESC").Find(&submissions).Error; err != nil {
			return nil, 0, err
		}

		// 获取每个作品的得票数
		voteService := &VoteService{}
		for _, s := range submissions {
			voteCount, _ := voteService.GetVoteCount(s.ID)
			list = append(list, map[string]interface{}{
				"submission_name": s.Name,
				"team_name":       s.Team.Name,
				"created_at":      s.CreatedAt,
				"vote_count":      voteCount,
			})
		}

	default:
		return nil, 0, errors.New("无效的统计类型")
	}

	return list, total, nil
}

// UpdateHackathon 更新活动
// 根据权限矩阵：
// - 预备状态：仅活动创建者可以编辑所有字段
// - 发布状态及后续：活动创建者不能编辑活动基本信息，只能管理阶段
func (s *HackathonService) UpdateHackathon(id uint64, hackathon *models.Hackathon, stages []models.HackathonStage, awards []models.HackathonAward, userID uint64, userRole string) error {
	// 检查活动是否存在
	var existing models.Hackathon
	if err := database.DB.Where("id = ? AND deleted_at IS NULL", id).First(&existing).Error; err != nil {
		return err
	}

	// Admin不能编辑活动
	if userRole == "admin" {
		return errors.New("Admin不能编辑活动")
	}

	// 检查是否是活动创建者
	if existing.OrganizerID != userID {
		return errors.New("只能编辑自己创建的活动")
	}

	// 如果活动已发布，只能更新阶段，不能更新基本信息
	if existing.Status != "preparation" {
		// 已发布的活动只能更新阶段
		return database.DB.Transaction(func(tx *gorm.DB) error {
			// 删除旧阶段
			if err := tx.Where("hackathon_id = ?", id).Delete(&models.HackathonStage{}).Error; err != nil {
				return err
			}

			// 创建新阶段
			for i := range stages {
				stages[i].HackathonID = id
				if err := tx.Create(&stages[i]).Error; err != nil {
					return err
				}
			}

			// 删除旧奖项
			if err := tx.Where("hackathon_id = ?", id).Delete(&models.HackathonAward{}).Error; err != nil {
				return err
			}

			// 创建新奖项
			for i := range awards {
				awards[i].HackathonID = id
				if err := tx.Create(&awards[i]).Error; err != nil {
					return err
				}
			}

			return nil
		})
	}

	return database.DB.Transaction(func(tx *gorm.DB) error {
		// 更新活动
		if err := tx.Model(&models.Hackathon{}).Where("id = ?", id).Updates(hackathon).Error; err != nil {
			return err
		}

		// 删除旧阶段
		if err := tx.Where("hackathon_id = ?", id).Delete(&models.HackathonStage{}).Error; err != nil {
			return err
		}

		// 创建新阶段
		for i := range stages {
			stages[i].HackathonID = id
			if err := tx.Create(&stages[i]).Error; err != nil {
				return err
			}
		}

		// 删除旧奖项
		if err := tx.Where("hackathon_id = ?", id).Delete(&models.HackathonAward{}).Error; err != nil {
			return err
		}

		// 创建新奖项
		for i := range awards {
			awards[i].HackathonID = id
			if err := tx.Create(&awards[i]).Error; err != nil {
				return err
			}
		}

		return nil
	})
}

// DeleteHackathon 删除活动（仅预备状态，且仅活动创建者可删除）
func (s *HackathonService) DeleteHackathon(id uint64, userID uint64, userRole string) error {
	var hackathon models.Hackathon
	if err := database.DB.Where("id = ? AND deleted_at IS NULL", id).First(&hackathon).Error; err != nil {
		return err
	}

	// Admin不能删除活动
	if userRole == "admin" {
		return errors.New("Admin不能删除活动")
	}

	// 检查是否是活动创建者
	if hackathon.OrganizerID != userID {
		return errors.New("只能删除自己创建的活动")
	}

	if hackathon.Status != "preparation" {
		return errors.New("只能删除处于预备状态的活动")
	}

	return database.DB.Delete(&hackathon).Error
}

// UpdateChainActivityAddress 更新活动链上地址（仅活动创建者可更新，上链后补填 PDA）
func (s *HackathonService) UpdateChainActivityAddress(id uint64, userID uint64, userRole string, chainActivityAddress string) error {
	var hackathon models.Hackathon
	if err := database.DB.Where("id = ? AND deleted_at IS NULL", id).First(&hackathon).Error; err != nil {
		return err
	}
	if userRole == "admin" {
		return errors.New("Admin不能修改活动链上地址")
	}
	if hackathon.OrganizerID != userID {
		return errors.New("只能修改自己创建活动的链上地址")
	}
	chainActivityAddress = strings.TrimSpace(chainActivityAddress)
	if chainActivityAddress != "" && !utils.IsValidSolanaAddress(chainActivityAddress) {
		return errors.New("无效的 Solana 地址")
	}
	return database.DB.Model(&hackathon).Update("chain_activity_address", chainActivityAddress).Error
}

// PreparePublish 返回前端构建并签名 publish_activity 交易所需的数据。发布由前端钱包（Phantom）授权，后端不配置私钥。
func (s *HackathonService) PreparePublish(id uint64, userID uint64, userRole string) (map[string]interface{}, error) {
	var hackathon models.Hackathon
	if err := database.DB.Where("id = ? AND deleted_at IS NULL", id).First(&hackathon).Error; err != nil {
		return nil, err
	}
	if userRole == "admin" {
		return nil, errors.New("Admin不能发布活动")
	}
	if hackathon.OrganizerID != userID {
		return nil, errors.New("只能发布自己创建的活动")
	}
	if hackathon.Status != "preparation" {
		return nil, errors.New("只能发布处于预备状态的活动")
	}
	var stages []models.HackathonStage
	if err := database.DB.Where("hackathon_id = ?", id).Find(&stages).Error; err != nil {
		return nil, fmt.Errorf("检查阶段时间失败: %w", err)
	}
	requiredStages := []string{"registration", "checkin", "team_formation", "submission", "voting"}
	stageMap := make(map[string]bool)
	for _, stage := range stages {
		stageMap[stage.Stage] = true
	}
	for _, requiredStage := range requiredStages {
		if !stageMap[requiredStage] {
			return nil, errors.New("活动阶段时间未设置，请先设置所有阶段时间后再发布")
		}
	}
	programID, rpcURL, err := solana.PreparePublishConfig()
	if err != nil {
		return nil, err
	}
	if len(hackathon.Name) > 128 {
		return nil, errors.New("活动发布不成功：活动标题超过 128 字节，无法上链")
	}
	descHash := sha256.Sum256([]byte(hackathon.Description))
	descHashHex := fmt.Sprintf("%x", descHash)
	return map[string]interface{}{
		"program_id":           programID,
		"rpc_url":              rpcURL,
		"activity_id":          id,
		"title":                hackathon.Name,
		"description_hash_hex": descHashHex,
	}, nil
}

// PublishHackathon 发布活动：接收前端钱包已签名的交易并提交上链，链上活动地址由前端按 PDA 规则计算后传入。上链失败则返回错误，活动不发布。
func (s *HackathonService) PublishHackathon(id uint64, userID uint64, userRole string, signedTxBase64 string, activityPDA string) (map[string]interface{}, error) {
	var hackathon models.Hackathon
	if err := database.DB.Where("id = ? AND deleted_at IS NULL", id).First(&hackathon).Error; err != nil {
		return nil, err
	}
	if userRole == "admin" {
		return nil, errors.New("Admin不能发布活动")
	}
	if hackathon.OrganizerID != userID {
		return nil, errors.New("只能发布自己创建的活动")
	}
	if hackathon.Status != "preparation" {
		return nil, errors.New("只能发布处于预备状态的活动")
	}
	activityPDA = strings.TrimSpace(activityPDA)
	if activityPDA == "" {
		return nil, errors.New("活动发布不成功：未提供链上活动地址（activity_pda）")
	}
	_, rpcURL, err := solana.PreparePublishConfig()
	if err != nil {
		return nil, err
	}
	txSig, err := solana.SubmitSignedTransaction(signedTxBase64, rpcURL)
	if err != nil {
		return nil, err
	}
	// 等待链上确认后再写入 chain_activity_address，避免用户立即“切换到报名”时 activity 未初始化（AccountNotInitialized）
	if err := solana.WaitForConfirmation(rpcURL, txSig, 30*time.Second); err != nil {
		return nil, fmt.Errorf("交易已提交但确认失败: %w", err)
	}

	updates := map[string]interface{}{
		"status":                 "published",
		"chain_activity_address": activityPDA,
	}
	if err := database.DB.Model(&hackathon).Updates(updates).Error; err != nil {
		return nil, err
	}
	posterURL := fmt.Sprintf("/posters/%d", id)
	qrCodeURL, err := s.generatePosterQRCode(id, posterURL)
	if err != nil {
		qrCodeURL = ""
	}
	return map[string]interface{}{
		"poster_url":   posterURL,
		"qr_code_url":  qrCodeURL,
		"hackathon_id": id,
	}, nil
}

// generatePosterQRCode 生成海报二维码
func (s *HackathonService) generatePosterQRCode(hackathonID uint64, posterURL string) (string, error) {
	// 构建完整的海报URL（需要根据实际部署环境配置）
	// 这里假设Arena平台的基础URL，实际应该从配置中读取
	// 可以通过环境变量或配置文件设置
	baseURL := "http://localhost:3001" // TODO: 从配置读取
	fullURL := baseURL + posterURL

	// 生成二维码Base64
	qrCodeBase64, err := utils.GenerateQRCodeBase64(fullURL, 256)
	if err != nil {
		return "", fmt.Errorf("生成二维码失败: %w", err)
	}

	return qrCodeBase64, nil
}

// GetPosterQRCode 获取活动海报二维码（用于已发布的活动）
func (s *HackathonService) GetPosterQRCode(hackathonID uint64) (string, error) {
	// 检查活动是否存在且已发布
	var hackathon models.Hackathon
	if err := database.DB.Where("id = ? AND deleted_at IS NULL", hackathonID).First(&hackathon).Error; err != nil {
		return "", errors.New("活动不存在")
	}

	if hackathon.Status == "preparation" {
		return "", errors.New("活动尚未发布")
	}

	posterURL := fmt.Sprintf("/posters/%d", hackathonID)
	return s.generatePosterQRCode(hackathonID, posterURL)
}

// NeedChainStageUpdate 判断该阶段是否需要更新链上活动状态（报名、签到、组队、上传代码、投票、公布结果均需链上更新）。
func NeedChainStageUpdate(stage string) bool {
	switch stage {
	case "registration", "checkin", "team_formation", "submission", "voting", "results":
		return true
	default:
		return false
	}
}

// PrepareSwitchStage 返回切换阶段时如需更新链上状态，前端构建并签名交易所需的数据。
// 签到->组队：返回 upload_check_ins + attendee_pubkeys（仅 Phantom 钱包签到用户）。
// 投票->公布结果：返回 upload_vote_tally + candidate_ids + vote_counts。
func (s *HackathonService) PrepareSwitchStage(id uint64, stage string, userID uint64, userRole string) (map[string]interface{}, error) {
	if !NeedChainStageUpdate(stage) {
		return map[string]interface{}{"need_chain_update": false}, nil
	}
	var hackathon models.Hackathon
	if err := database.DB.Where("id = ? AND deleted_at IS NULL", id).First(&hackathon).Error; err != nil {
		return nil, err
	}
	if userRole == "admin" {
		return nil, errors.New("Admin不能切换活动阶段")
	}
	if hackathon.OrganizerID != userID {
		return nil, errors.New("只能切换自己创建的活动阶段")
	}
	chainAddr := strings.TrimSpace(hackathon.ChainActivityAddress)
	if chainAddr == "" {
		return map[string]interface{}{"need_chain_update": false}, nil
	}
	programID, rpcURL, err := solana.PreparePublishConfig()
	if err != nil {
		return nil, err
	}

	// 签到->组队：需将签到信息上链，返回 upload_check_ins 及签到者 Solana 地址列表
	if stage == "team_formation" {
		var checkins []struct {
			WalletAddress string `gorm:"column:wallet_address"`
			WalletType    string `gorm:"column:wallet_type"`
		}
		if err := database.DB.Model(&models.Checkin{}).
			Joins("INNER JOIN participants ON participants.id = checkins.participant_id").
			Where("checkins.hackathon_id = ?", id).
			Select("participants.wallet_address, participants.wallet_type").
			Find(&checkins).Error; err != nil {
			return nil, fmt.Errorf("获取签到列表失败: %w", err)
		}
		attendeePubkeys := make([]string, 0)
		for _, c := range checkins {
			if c.WalletType == "phantom" && strings.TrimSpace(c.WalletAddress) != "" {
				attendeePubkeys = append(attendeePubkeys, c.WalletAddress)
			}
		}
		return map[string]interface{}{
			"need_chain_update":      true,
			"program_id":             programID,
			"rpc_url":                rpcURL,
			"chain_activity_address": chainAddr,
			"activity_id":            id,
			"chain_instruction":      "upload_check_ins",
			"attendee_pubkeys":       attendeePubkeys,
		}, nil
	}

	// 投票->公布结果：需将投票汇总上链，返回 upload_vote_tally 及 candidate_ids、vote_counts
	if stage == "results" {
		var submissions []models.Submission
		if err := database.DB.Where("hackathon_id = ? AND draft = 0", id).Find(&submissions).Error; err != nil {
			return nil, fmt.Errorf("获取作品列表失败: %w", err)
		}
		voteSvc := &VoteService{}
		candidateIDs := make([]uint64, 0, len(submissions))
		voteCounts := make([]uint64, 0, len(submissions))
		for _, sub := range submissions {
			count, _ := voteSvc.GetVoteCount(sub.ID)
			if count < 0 {
				count = 0
			}
			candidateIDs = append(candidateIDs, sub.ID)
			voteCounts = append(voteCounts, uint64(count))
		}
		return map[string]interface{}{
			"need_chain_update":      true,
			"program_id":             programID,
			"rpc_url":                rpcURL,
			"chain_activity_address": chainAddr,
			"activity_id":            id,
			"chain_instruction":      "upload_vote_tally",
			"candidate_ids":          candidateIDs,
			"vote_counts":            voteCounts,
		}, nil
	}

	// 其他阶段：仅更新链上活动状态
	chainInstruction := map[string]string{
		"registration": "start_registration",
		"checkin":      "start_check_in",
		"submission":   "start_submission",
		"voting":       "start_voting",
	}[stage]
	return map[string]interface{}{
		"need_chain_update":      true,
		"program_id":             programID,
		"rpc_url":                rpcURL,
		"chain_activity_address": chainAddr,
		"activity_id":            id,
		"chain_instruction":      chainInstruction,
	}, nil
}

// SwitchStage 切换活动阶段（仅活动创建者可切换）。若阶段为 registration/checkin/team_formation/submission/voting/results 且活动已上链，需传入主办方已签名的链上交易并先更新链上状态再更新 DB。
func (s *HackathonService) SwitchStage(id uint64, stage string, userID uint64, userRole string, signedTxBase64 string) error {
	validStages := map[string]bool{
		"published":      true,
		"registration":   true,
		"checkin":        true,
		"team_formation": true,
		"submission":     true,
		"voting":         true,
		"results":        true,
	}

	if !validStages[stage] {
		return errors.New("无效的阶段")
	}

	var hackathon models.Hackathon
	if err := database.DB.Where("id = ? AND deleted_at IS NULL", id).First(&hackathon).Error; err != nil {
		return err
	}

	// Admin不能切换阶段
	if userRole == "admin" {
		return errors.New("Admin不能切换活动阶段")
	}

	// 检查是否是活动创建者
	if hackathon.OrganizerID != userID {
		return errors.New("只能切换自己创建的活动阶段")
	}

	// 若该阶段需要更新链上活动状态且活动已上链，则必须先提交已签名交易再更新 DB
	if NeedChainStageUpdate(stage) && strings.TrimSpace(hackathon.ChainActivityAddress) != "" {
		signedTxBase64 = strings.TrimSpace(signedTxBase64)
		if signedTxBase64 == "" {
			return errors.New("切换到此阶段需更新链上活动状态，请使用钱包授权后提交已签名交易（signed_transaction）")
		}
		_, rpcURL, err := solana.PreparePublishConfig()
		if err != nil {
			return err
		}
		// 提交前确认链上 activity 账户已存在，避免 start_registration 等报 AccountNotInitialized(3012)
		exists, err := solana.ActivityAccountExists(rpcURL, hackathon.ChainActivityAddress)
		if err != nil {
			return fmt.Errorf("检查链上活动账户失败: %w", err)
		}
		if !exists {
			return errors.New("链上活动账户尚未就绪，请稍后重试（若刚发布活动，请等待几秒后再切换阶段）")
		}
		if _, err := solana.SubmitSignedTransaction(signedTxBase64, rpcURL); err != nil {
			return fmt.Errorf("链上活动状态更新失败: %w", err)
		}
	}

	return database.DB.Model(&hackathon).Update("status", stage).Error
}

// GetPublishedHackathons 获取已发布的活动列表（Arena平台）
func (s *HackathonService) GetPublishedHackathons(page, pageSize int, status, keyword, sort string) ([]models.Hackathon, int64, error) {
	var hackathons []models.Hackathon
	var total int64

	query := database.DB.Model(&models.Hackathon{}).Where("deleted_at IS NULL AND status != 'preparation'")

	if status != "" {
		query = query.Where("status = ?", status)
	}

	if keyword != "" {
		query = query.Where("name LIKE ?", "%"+keyword+"%")
	}

	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	// 排序
	if sort == "time_asc" {
		query = query.Order("start_time ASC")
	} else {
		query = query.Order("start_time DESC")
	}

	offset := (page - 1) * pageSize
	if err := query.Offset(offset).Limit(pageSize).Find(&hackathons).Error; err != nil {
		return nil, 0, err
	}

	return hackathons, total, nil
}

// GetMyHackathons 获取已报名的活动列表（Arena平台）
func (s *HackathonService) GetMyHackathons(participantID uint64, page, pageSize int, status, keyword, sort string) ([]models.Hackathon, int64, error) {
	var hackathons []models.Hackathon
	var total int64

	// 通过报名记录关联查询已报名的活动
	query := database.DB.Model(&models.Hackathon{}).
		Joins("INNER JOIN registrations ON registrations.hackathon_id = hackathons.id").
		Where("hackathons.deleted_at IS NULL AND registrations.participant_id = ?", participantID)

	if status != "" {
		query = query.Where("hackathons.status = ?", status)
	}

	if keyword != "" {
		query = query.Where("hackathons.name LIKE ?", "%"+keyword+"%")
	}

	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	// 排序
	if sort == "time_asc" {
		query = query.Order("hackathons.start_time ASC")
	} else {
		query = query.Order("hackathons.start_time DESC")
	}

	offset := (page - 1) * pageSize
	if err := query.Offset(offset).Limit(pageSize).Find(&hackathons).Error; err != nil {
		return nil, 0, err
	}

	return hackathons, total, nil
}

// CheckStageTime 检查当前时间是否在阶段时间范围内
func (s *HackathonService) CheckStageTime(hackathonID uint64, stage string) (bool, error) {
	var stageModel models.HackathonStage
	if err := database.DB.Where("hackathon_id = ? AND stage = ?", hackathonID, stage).First(&stageModel).Error; err != nil {
		return false, err
	}

	now := time.Now()
	return now.After(stageModel.StartTime) && now.Before(stageModel.EndTime), nil
}

// CheckHackathonCreator 检查用户是否是活动的创建者
func (s *HackathonService) CheckHackathonCreator(hackathonID, userID uint64) (bool, error) {
	var hackathon models.Hackathon
	if err := database.DB.Where("id = ? AND deleted_at IS NULL", hackathonID).First(&hackathon).Error; err != nil {
		return false, err
	}
	return hackathon.OrganizerID == userID, nil
}

// ArchiveHackathon 归档活动（软删除，仅已发布的活动可归档）
func (s *HackathonService) ArchiveHackathon(id uint64) error {
	var hackathon models.Hackathon
	if err := database.DB.Where("id = ? AND deleted_at IS NULL", id).First(&hackathon).Error; err != nil {
		return err
	}

	// 只能归档已发布的活动
	if hackathon.Status == "preparation" {
		return errors.New("只能归档已发布的活动")
	}

	return database.DB.Delete(&hackathon).Error
}

// BatchArchiveHackathons 批量归档活动
func (s *HackathonService) BatchArchiveHackathons(ids []uint64) error {
	return database.DB.Transaction(func(tx *gorm.DB) error {
		for _, id := range ids {
			var hackathon models.Hackathon
			if err := tx.Where("id = ? AND deleted_at IS NULL", id).First(&hackathon).Error; err != nil {
				continue // 跳过不存在的活动
			}

			// 只能归档已发布的活动
			if hackathon.Status == "preparation" {
				continue // 跳过预备状态的活动
			}

			if err := tx.Delete(&hackathon).Error; err != nil {
				return err
			}
		}
		return nil
	})
}

// UnarchiveHackathon 取消归档活动（恢复已归档的活动）
func (s *HackathonService) UnarchiveHackathon(id uint64) error {
	var hackathon models.Hackathon
	if err := database.DB.Unscoped().Where("id = ? AND deleted_at IS NOT NULL", id).First(&hackathon).Error; err != nil {
		return errors.New("活动不存在或未被归档")
	}

	// 恢复活动（取消软删除）
	return database.DB.Unscoped().Model(&hackathon).Update("deleted_at", nil).Error
}

// UpdateStageTimes 更新活动阶段时间（仅活动创建者可设置）
func (s *HackathonService) UpdateStageTimes(hackathonID uint64, stages []models.HackathonStage, userID uint64, userRole string) error {
	// 检查活动是否存在
	var hackathon models.Hackathon
	if err := database.DB.Where("id = ? AND deleted_at IS NULL", hackathonID).First(&hackathon).Error; err != nil {
		return errors.New("活动不存在")
	}

	// Admin不能设置阶段时间
	if userRole == "admin" {
		return errors.New("Admin不能设置活动阶段时间")
	}

	// 检查是否是活动创建者
	if hackathon.OrganizerID != userID {
		return errors.New("只能设置自己创建的活动阶段时间")
	}

	// 验证阶段时间
	if err := s.validateStageTimes(hackathonID, stages, &hackathon); err != nil {
		return err
	}

	// 更新阶段时间
	return database.DB.Transaction(func(tx *gorm.DB) error {
		// 删除旧阶段
		if err := tx.Where("hackathon_id = ?", hackathonID).Delete(&models.HackathonStage{}).Error; err != nil {
			return err
		}

		// 创建新阶段
		for i := range stages {
			stages[i].HackathonID = hackathonID
			if err := tx.Create(&stages[i]).Error; err != nil {
				return err
			}
		}

		return nil
	})
}

// GetStageTimes 获取活动阶段时间设置
func (s *HackathonService) GetStageTimes(hackathonID uint64) ([]models.HackathonStage, error) {
	var stages []models.HackathonStage
	if err := database.DB.Where("hackathon_id = ?", hackathonID).Order("start_time ASC").Find(&stages).Error; err != nil {
		return nil, err
	}
	return stages, nil
}

// validateStageTimes 验证阶段时间
func (s *HackathonService) validateStageTimes(hackathonID uint64, stages []models.HackathonStage, hackathon *models.Hackathon) error {
	// 阶段顺序
	stageOrder := map[string]int{
		"registration":   1,
		"checkin":        2,
		"team_formation": 3,
		"submission":     4,
		"voting":         5,
	}

	// 检查每个阶段的时间
	for _, stage := range stages {
		// 开始时间不能早于活动开始时间
		if stage.StartTime.Before(hackathon.StartTime) {
			return fmt.Errorf("阶段 %s 的开始时间不能早于活动开始时间", stage.Stage)
		}

		// 结束时间不能晚于活动结束时间
		if stage.EndTime.After(hackathon.EndTime) {
			return fmt.Errorf("阶段 %s 的结束时间不能晚于活动结束时间", stage.Stage)
		}

		// 开始时间必须早于结束时间
		if !stage.StartTime.Before(stage.EndTime) {
			return fmt.Errorf("阶段 %s 的开始时间必须早于结束时间", stage.Stage)
		}
	}

	// 检查阶段时间是否重叠
	for i := 0; i < len(stages); i++ {
		for j := i + 1; j < len(stages); j++ {
			// 如果两个阶段的时间有重叠
			if stages[i].StartTime.Before(stages[j].EndTime) && stages[j].StartTime.Before(stages[i].EndTime) {
				return fmt.Errorf("阶段 %s 和 %s 的时间重叠", stages[i].Stage, stages[j].Stage)
			}
		}
	}

	// 检查阶段顺序（后一个阶段的开始时间不能早于前一个阶段的结束时间）
	for i := 0; i < len(stages)-1; i++ {
		for j := i + 1; j < len(stages); j++ {
			if stageOrder[stages[i].Stage] < stageOrder[stages[j].Stage] {
				// stages[i] 应该在 stages[j] 之前
				if stages[j].StartTime.Before(stages[i].EndTime) {
					return fmt.Errorf("阶段 %s 的开始时间不能早于阶段 %s 的结束时间", stages[j].Stage, stages[i].Stage)
				}
			}
		}
	}

	return nil
}

// GetArchiveHackathons 获取活动集锦列表（已结束的活动）
func (s *HackathonService) GetArchiveHackathons(page, pageSize int, keyword, timeRange string) ([]models.Hackathon, int64, error) {
	var hackathons []models.Hackathon
	var total int64

	query := database.DB.Model(&models.Hackathon{}).
		Where("deleted_at IS NULL AND status = 'results'")

	// 时间范围筛选
	if timeRange != "" && timeRange != "all" {
		now := time.Now()
		var startTime time.Time
		switch timeRange {
		case "month":
			startTime = now.AddDate(0, -1, 0)
		case "quarter":
			startTime = now.AddDate(0, -3, 0)
		case "half_year":
			startTime = now.AddDate(0, -6, 0)
		}
		if !startTime.IsZero() {
			query = query.Where("end_time >= ?", startTime)
		}
	}

	// 关键词搜索
	if keyword != "" {
		query = query.Where("name LIKE ?", "%"+keyword+"%")
	}

	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	// 按结束时间倒序
	offset := (page - 1) * pageSize
	if err := query.Order("end_time DESC").Offset(offset).Limit(pageSize).Find(&hackathons).Error; err != nil {
		return nil, 0, err
	}

	return hackathons, total, nil
}

// GetArchiveDetail 获取活动集锦详情
func (s *HackathonService) GetArchiveDetail(hackathonID uint64) (map[string]interface{}, error) {
	// 获取活动信息
	hackathon, err := s.GetHackathonByID(hackathonID)
	if err != nil {
		return nil, errors.New("活动不存在")
	}

	// 检查活动是否已结束
	if hackathon.Status != "results" {
		return nil, errors.New("活动尚未结束")
	}

	// 获取统计信息
	stats, err := s.GetHackathonStats(hackathonID)
	if err != nil {
		return nil, err
	}

	// 获取所有作品
	var submissions []models.Submission
	if err := database.DB.
		Preload("Team").
		Where("hackathon_id = ? AND draft = 0", hackathonID).
		Find(&submissions).Error; err != nil {
		return nil, err
	}

	// 计算每个作品的得票数
	submissionVoteCounts := make(map[uint64]int64)
	voteService := &VoteService{}
	for _, submission := range submissions {
		count, _ := voteService.GetVoteCount(submission.ID)
		submissionVoteCounts[submission.ID] = count
	}

	// 获取投票结果
	var votes []models.Vote
	if err := database.DB.
		Where("hackathon_id = ?", hackathonID).
		Find(&votes).Error; err != nil {
		return nil, err
	}

	// 计算每个作品的得票数和得票率
	voteResults := make([]map[string]interface{}, 0)
	totalVotes := int64(len(votes))
	for _, submission := range submissions {
		voteCount := submissionVoteCounts[submission.ID]
		var voteRate float64
		if totalVotes > 0 {
			voteRate = float64(voteCount) / float64(totalVotes) * 100
		}
		voteResults = append(voteResults, map[string]interface{}{
			"submission_id":   submission.ID,
			"submission_name": submission.Name,
			"team_name":       submission.Team.Name,
			"vote_count":      voteCount,
			"vote_rate":       voteRate,
		})
	}

	// 按得票数排序作品
	for i := 0; i < len(submissions)-1; i++ {
		for j := i + 1; j < len(submissions); j++ {
			if submissionVoteCounts[submissions[i].ID] < submissionVoteCounts[submissions[j].ID] {
				submissions[i], submissions[j] = submissions[j], submissions[i]
			}
		}
	}

	// 获取比赛结果（获奖队伍）
	var awards []models.HackathonAward
	if err := database.DB.Where("hackathon_id = ?", hackathonID).Order("`rank` ASC").Find(&awards).Error; err != nil {
		return nil, err
	}

	finalResults := make([]map[string]interface{}, 0)
	submissionIndex := 0
	for _, award := range awards {
		// 根据奖项排名获取对应的作品（按得票数排序后的前N个）
		awardResults := make([]map[string]interface{}, 0)
		for i := 0; i < award.Quantity && submissionIndex < len(submissions); i++ {
			submission := submissions[submissionIndex]
			voteCount := submissionVoteCounts[submission.ID]
			awardResults = append(awardResults, map[string]interface{}{
				"team_name":       submission.Team.Name,
				"submission_name": submission.Name,
				"vote_count":      voteCount,
				"prize_money":     award.Prize,
			})
			submissionIndex++
		}
		finalResults = append(finalResults, map[string]interface{}{
			"award_name": award.Name,
			"prize":      award.Prize,
			"quantity":   award.Quantity,
			"winners":    awardResults,
		})
	}

	return map[string]interface{}{
		"hackathon":     hackathon,
		"stats":         stats,
		"submissions":   submissions,
		"vote_results":  voteResults,
		"final_results": finalResults,
	}, nil
}
