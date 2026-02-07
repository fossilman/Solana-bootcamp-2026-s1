package utils

import (
	"errors"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"hackathon-backend/config"
)

type Claims struct {
	UserID        uint64 `json:"user_id"`
	Phone         string `json:"phone,omitempty"`         // 手机号（可选）
	Role          string `json:"role"`
	WalletAddress string `json:"wallet_address,omitempty"` // 钱包地址（可选）
	jwt.RegisteredClaims
}

// GenerateToken 生成JWT Token（手机号登录）
func GenerateToken(userID uint64, phone, role string) (string, error) {
	claims := Claims{
		UserID:   userID,
		Phone:    phone,
		Role:     role,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(time.Duration(config.AppConfig.JWTExpireHours) * time.Hour)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(config.AppConfig.JWTSecret))
}

// GenerateWalletToken 生成Web3钱包登录JWT Token
func GenerateWalletToken(userID uint64, walletAddress, role string) (string, error) {
	claims := Claims{
		UserID:        userID,
		WalletAddress: walletAddress,
		Role:          role,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(time.Duration(config.AppConfig.JWTExpireHours) * time.Hour)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(config.AppConfig.JWTSecret))
}

// GenerateParticipantToken 生成参赛者JWT Token
func GenerateParticipantToken(participantID uint64, walletAddress string) (string, error) {
	claims := Claims{
		UserID:        participantID,
		WalletAddress: walletAddress,
		Role:          "participant",
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(time.Duration(config.AppConfig.JWTExpireHours) * time.Hour)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(config.AppConfig.JWTSecret))
}

// ParseToken 解析JWT Token
func ParseToken(tokenString string) (*Claims, error) {
	token, err := jwt.ParseWithClaims(tokenString, &Claims{}, func(token *jwt.Token) (interface{}, error) {
		return []byte(config.AppConfig.JWTSecret), nil
	})

	if err != nil {
		return nil, err
	}

	if claims, ok := token.Claims.(*Claims); ok && token.Valid {
		return claims, nil
	}

	return nil, errors.New("invalid token")
}

