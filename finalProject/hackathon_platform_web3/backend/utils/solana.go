package utils

import (
	"crypto/ed25519"
	"encoding/base64"
	"errors"
	"strings"

	"github.com/gagliardetto/solana-go"
)

// IsValidSolanaAddress 校验是否为合法 Solana 地址（base58 编码的公钥），使用 solana-go 解析。
func IsValidSolanaAddress(s string) bool {
	s = strings.TrimSpace(s)
	if s == "" {
		return false
	}
	_, err := solana.PublicKeyFromBase58(s)
	return err == nil
}

// VerifySolanaSignature 使用 Ed25519 验证 Phantom/Solana 签名。公钥通过 solana-go 解析。
// address: base58 公钥；message: 原文；signatureBase64: 签名的 base64（64 字节）。
func VerifySolanaSignature(address, message, signatureBase64 string) error {
	pubKey, err := solana.PublicKeyFromBase58(strings.TrimSpace(address))
	if err != nil {
		return errors.New("无效的 Solana 地址")
	}
	sig, err := base64.StdEncoding.DecodeString(strings.TrimSpace(signatureBase64))
	if err != nil {
		return errors.New("签名 base64 解析失败")
	}
	if len(sig) != ed25519.SignatureSize {
		return errors.New("签名长度错误")
	}
	msgBytes := []byte(message)
	if !ed25519.Verify(pubKey[:], msgBytes, sig) {
		return errors.New("签名验证失败")
	}
	return nil
}
