// Package solana 赞助商链上 config 自动初始化：首次赞助相关请求时如 config 未初始化则用 authority 私钥提交 initialize_sponsor_config。
package solana

import (
	"context"
	"encoding/binary"
	"errors"
	"fmt"
	"strings"
	"time"

	"hackathon-backend/config"

	"github.com/gagliardetto/solana-go"
	"github.com/gagliardetto/solana-go/rpc"
)

// initialize_sponsor_config 的 Anchor 指令 discriminator（来自 IDL）
var initSponsorConfigDiscriminator = [8]byte{233, 86, 2, 56, 141, 50, 231, 94}

const defaultSponsorReviewPeriodSecs = 10800 // 3 小时

// SponsorConfigPDA 返回赞助商 config 账户 PDA（seeds: "config"）
func SponsorConfigPDA(programID string) (solana.PublicKey, error) {
	program, err := solana.PublicKeyFromBase58(strings.TrimSpace(programID))
	if err != nil {
		return solana.PublicKey{}, err
	}
	pda, _, err := solana.FindProgramAddress(
		[][]byte{[]byte("config")},
		program,
	)
	return pda, err
}

// SponsorTreasuryPDA 返回赞助商金库 PDA（seeds: "treasury"）
func SponsorTreasuryPDA(programID string) (solana.PublicKey, error) {
	program, err := solana.PublicKeyFromBase58(strings.TrimSpace(programID))
	if err != nil {
		return solana.PublicKey{}, err
	}
	pda, _, err := solana.FindProgramAddress(
		[][]byte{[]byte("treasury")},
		program,
	)
	return pda, err
}

// SponsorApplicationPDA 返回赞助商申请链上账户 PDA（seeds: "sponsor_application", application_id LE）
func SponsorApplicationPDA(programID string, applicationID uint64) (solana.PublicKey, error) {
	program, err := solana.PublicKeyFromBase58(strings.TrimSpace(programID))
	if err != nil {
		return solana.PublicKey{}, err
	}
	idBytes := make([]byte, 8)
	binary.LittleEndian.PutUint64(idBytes, applicationID)
	pda, _, err := solana.FindProgramAddress(
		[][]byte{[]byte("sponsor_application"), idBytes},
		program,
	)
	return pda, err
}

// SponsorConfigExists 检查链上 sponsor config 账户是否已存在
func SponsorConfigExists(rpcURL, programID string) (bool, error) {
	configPDA, err := SponsorConfigPDA(programID)
	if err != nil {
		return false, err
	}
	client := rpc.New(rpcURL)
	acc, err := client.GetAccountInfo(context.Background(), configPDA)
	if err != nil {
		return false, err
	}
	return acc != nil && acc.Value != nil && len(acc.Value.Data.GetBinary()) >= 8, nil
}

// EnsureSponsorConfigInitialized 若链上 sponsor config 未初始化且已配置 authority 私钥，则提交 initialize_sponsor_config 交易（仅需执行一次）。
// 未配置 authority 或 config 已存在时直接返回 nil。
func EnsureSponsorConfigInitialized() error {
	cfg := config.AppConfig
	if cfg == nil || cfg.Solana.RPCURL == "" || cfg.Solana.ProgramID == "" {
		return nil
	}
	programID := strings.TrimSpace(cfg.Solana.ProgramID)
	rpcURL := strings.TrimSpace(cfg.Solana.RPCURL)
	authorityKey := strings.TrimSpace(cfg.Solana.AuthorityKey)
	adminWalletStr := strings.TrimSpace(cfg.Solana.SponsorAdminWallet)

	exists, err := SponsorConfigExists(rpcURL, programID)
	if err != nil {
		return fmt.Errorf("检查 sponsor config 状态失败: %w", err)
	}
	if exists {
		return nil
	}
	if authorityKey == "" {
		return errors.New("链上赞助商 config 未初始化，且未配置 SOLANA_AUTHORITY_KEY，无法自动初始化。请配置 Admin 账户私钥（Base58）")
	}

	authority, err := solana.PrivateKeyFromBase58(authorityKey)
	if err != nil {
		return fmt.Errorf("SOLANA_AUTHORITY_KEY 格式错误: %w", err)
	}

	var adminWallet solana.PublicKey
	if adminWalletStr != "" {
		adminWallet, err = solana.PublicKeyFromBase58(adminWalletStr)
		if err != nil {
			return fmt.Errorf("主办方钱包地址格式错误: %w", err)
		}
	} else {
		adminWallet = authority.PublicKey()
	}

	reviewPeriodSecs := defaultSponsorReviewPeriodSecs
	if cfg.Solana.SponsorReviewPeriodSecs > 0 {
		reviewPeriodSecs = cfg.Solana.SponsorReviewPeriodSecs
	}

	configPDA, err := SponsorConfigPDA(programID)
	if err != nil {
		return err
	}
	treasuryPDA, err := SponsorTreasuryPDA(programID)
	if err != nil {
		return err
	}
	programPubkey, _ := solana.PublicKeyFromBase58(programID)

	// 指令数据：8 字节 discriminator + admin_wallet(32) + review_period_secs(u64 LE)
	data := make([]byte, 8+32+8)
	copy(data[0:8], initSponsorConfigDiscriminator[:])
	copy(data[8:40], adminWallet.Bytes())
	binary.LittleEndian.PutUint64(data[40:48], uint64(reviewPeriodSecs))

	ix := solana.NewInstruction(
		programPubkey,
		solana.AccountMetaSlice{
			{PublicKey: authority.PublicKey(), IsSigner: true, IsWritable: true},
			{PublicKey: configPDA, IsSigner: false, IsWritable: true},
			{PublicKey: treasuryPDA, IsSigner: false, IsWritable: true},
			{PublicKey: solana.SystemProgramID, IsSigner: false, IsWritable: false},
		},
		data,
	)

	client := rpc.New(rpcURL)
	recent, err := client.GetLatestBlockhash(context.Background(), rpc.CommitmentFinalized)
	if err != nil {
		return fmt.Errorf("获取 blockhash 失败: %w", err)
	}

	tx, err := solana.NewTransaction(
		[]solana.Instruction{ix},
		recent.Value.Blockhash,
		solana.TransactionPayer(authority.PublicKey()),
	)
	if err != nil {
		return err
	}

	_, err = tx.Sign(
		func(key solana.PublicKey) *solana.PrivateKey {
			if authority.PublicKey().Equals(key) {
				return &authority
			}
			return nil
		},
	)
	if err != nil {
		return fmt.Errorf("签名失败: %w", err)
	}

	sig, err := client.SendTransactionWithOpts(
		context.Background(),
		tx,
		rpc.TransactionOpts{
			SkipPreflight:       false,
			PreflightCommitment: rpc.CommitmentConfirmed,
		},
	)
	if err != nil {
		return fmt.Errorf("提交 initialize_sponsor_config 失败: %w", err)
	}

	// 等待确认，避免后续 sponsor_apply 时 config 尚未可见
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	ticker := time.NewTicker(500 * time.Millisecond)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return fmt.Errorf("等待初始化交易确认超时: %w", ctx.Err())
		case <-ticker.C:
			res, err := client.GetSignatureStatuses(ctx, true, sig)
			if err != nil {
				continue
			}
			if res == nil || len(res.Value) == 0 || res.Value[0] == nil {
				continue
			}
			if res.Value[0].Err != nil {
				return fmt.Errorf("初始化交易执行失败: %v", res.Value[0].Err)
			}
			switch res.Value[0].ConfirmationStatus {
			case rpc.ConfirmationStatusConfirmed, rpc.ConfirmationStatusFinalized:
				return nil
			default:
				// 继续轮询
			}
		}
	}
}
