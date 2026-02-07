// Package solana 提供活动发布与阶段切换上链能力，统一使用 solana-go 库。发布/阶段切换由前端钱包（如 Phantom）授权签名，后端仅提交已签名交易。
package solana

import (
	"context"
	"encoding/base64"
	"errors"
	"fmt"
	"strings"
	"time"

	"hackathon-backend/config"

	bin "github.com/gagliardetto/binary"
	"github.com/gagliardetto/solana-go"
	"github.com/gagliardetto/solana-go/rpc"
)

// PreparePublishConfig 返回前端构建 publish_activity 交易所需的配置与数据，无需后端私钥。
func PreparePublishConfig() (programID, rpcURL string, err error) {
	cfg := config.AppConfig
	if cfg == nil || cfg.Solana.RPCURL == "" || cfg.Solana.ProgramID == "" {
		return "", "", errors.New("活动发布不成功：Solana 未配置（需设置 program_id 与 rpc_url）")
	}
	return strings.TrimSpace(cfg.Solana.ProgramID), strings.TrimSpace(cfg.Solana.RPCURL), nil
}

// SubmitSignedTransaction 将前端已签名的交易（base64 编码）提交到 Solana RPC，返回交易签名。使用 solana-go 的 RPC 客户端。
func SubmitSignedTransaction(signedTxBase64 string, rpcURL string) (txSignature string, err error) {
	signedTxBase64 = strings.TrimSpace(signedTxBase64)
	if signedTxBase64 == "" {
		return "", errors.New("活动发布不成功：未提供已签名交易")
	}
	if rpcURL == "" {
		return "", errors.New("活动发布不成功：未配置 RPC URL")
	}

	txBytes, err := base64.StdEncoding.DecodeString(signedTxBase64)
	if err != nil {
		return "", errors.New("活动发布不成功：交易 base64 解析失败")
	}

	dec := bin.NewBinDecoder(txBytes)
	tx, err := solana.TransactionFromDecoder(dec)
	if err != nil {
		return "", errors.New("活动发布不成功：交易解析失败")
	}

	client := rpc.New(rpcURL)
	sig, err := client.SendTransaction(context.Background(), tx)
	if err != nil {
		return "", err
	}
	return sig.String(), nil
}

// WaitForConfirmation 轮询交易状态直到已确认或超时。确认后链上账户才可用，避免“切换到报名”时 activity 未初始化。
func WaitForConfirmation(rpcURL, txSignature string, timeout time.Duration) error {
	txSignature = strings.TrimSpace(txSignature)
	if txSignature == "" || rpcURL == "" {
		return errors.New("缺少 RPC URL 或交易签名")
	}
	sig, err := solana.SignatureFromBase58(txSignature)
	if err != nil {
		return fmt.Errorf("交易签名格式错误: %w", err)
	}
	client := rpc.New(rpcURL)
	ctx, cancel := context.WithTimeout(context.Background(), timeout)
	defer cancel()
	ticker := time.NewTicker(500 * time.Millisecond)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return fmt.Errorf("等待交易确认超时: %w", ctx.Err())
		case <-ticker.C:
			res, err := client.GetSignatureStatuses(ctx, true, sig)
			if err != nil {
				continue
			}
			if res == nil || len(res.Value) == 0 || res.Value[0] == nil {
				continue
			}
			status := res.Value[0]
			if status.Err != nil {
				return fmt.Errorf("交易执行失败: %v", status.Err)
			}
			switch status.ConfirmationStatus {
			case rpc.ConfirmationStatusConfirmed, rpc.ConfirmationStatusFinalized:
				// 仅在被投票确认或终态后返回，确保 activity 账户已全局可见，避免“切换到报名”时 AccountNotInitialized
				return nil
			case rpc.ConfirmationStatusProcessed:
				// 不在此处返回：Processed 时账户可能尚未在所有节点可见，立即“切换到报名”会报 3012
			default:
				// 继续轮询
			}
		}
	}
}
