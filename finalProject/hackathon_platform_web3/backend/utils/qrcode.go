package utils

import (
	"bytes"
	"encoding/base64"
	"image/png"

	"github.com/skip2/go-qrcode"
)

// GenerateQRCode 生成二维码图片（PNG格式）
func GenerateQRCode(content string, size int) ([]byte, error) {
	qr, err := qrcode.New(content, qrcode.Medium)
	if err != nil {
		return nil, err
	}

	// 设置二维码大小
	qr.DisableBorder = false

	// 生成PNG图片
	var buf bytes.Buffer
	img := qr.Image(size)
	if err := png.Encode(&buf, img); err != nil {
		return nil, err
	}

	return buf.Bytes(), nil
}

// GenerateQRCodeBase64 生成二维码Base64字符串
func GenerateQRCodeBase64(content string, size int) (string, error) {
	qrBytes, err := GenerateQRCode(content, size)
	if err != nil {
		return "", err
	}

	return "data:image/png;base64," + base64.StdEncoding.EncodeToString(qrBytes), nil
}

