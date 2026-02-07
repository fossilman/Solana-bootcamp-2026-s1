// Package solana fetch 提供从链上读取活动签到、投票汇总等账户数据。

package solana

import (
	"context"
	"encoding/binary"
	"strings"

	"github.com/gagliardetto/solana-go"
	"github.com/gagliardetto/solana-go/rpc"
)

// ActivityAccountExists 检查链上 activity 账户是否已存在，用于在提交 start_registration 等前避免 AccountNotInitialized。
func ActivityAccountExists(rpcURL, activityAddr string) (bool, error) {
	addr := strings.TrimSpace(activityAddr)
	if addr == "" {
		return false, nil
	}
	pubkey, err := solana.PublicKeyFromBase58(addr)
	if err != nil {
		return false, err
	}
	client := rpc.New(rpcURL)
	acc, err := client.GetAccountInfo(context.Background(), pubkey)
	if err != nil {
		return false, err
	}
	return acc != nil && acc.Value != nil && len(acc.Value.Data.GetBinary()) >= 8, nil
}

// CheckInsPDA 根据 programID 与 activity 地址推导 check_ins PDA（seeds: "check_ins", activity）
func CheckInsPDA(programID, activityAddr string) (solana.PublicKey, error) {
	program, err := solana.PublicKeyFromBase58(strings.TrimSpace(programID))
	if err != nil {
		return solana.PublicKey{}, err
	}
	activity, err := solana.PublicKeyFromBase58(strings.TrimSpace(activityAddr))
	if err != nil {
		return solana.PublicKey{}, err
	}
	pda, _, err := solana.FindProgramAddress(
		[][]byte{[]byte("check_ins"), activity.Bytes()},
		program,
	)
	return pda, err
}

// VoteTallyPDA 根据 programID 与 activity 地址推导 vote_tally PDA（seeds: "vote_tally", activity）
func VoteTallyPDA(programID, activityAddr string) (solana.PublicKey, error) {
	program, err := solana.PublicKeyFromBase58(strings.TrimSpace(programID))
	if err != nil {
		return solana.PublicKey{}, err
	}
	activity, err := solana.PublicKeyFromBase58(strings.TrimSpace(activityAddr))
	if err != nil {
		return solana.PublicKey{}, err
	}
	pda, _, err := solana.FindProgramAddress(
		[][]byte{[]byte("vote_tally"), activity.Bytes()},
		program,
	)
	return pda, err
}

// FetchCheckIns 从 RPC 获取活动链上签到账户数据。account 不存在或未初始化时返回 nil, nil。
func FetchCheckIns(rpcURL, programID, activityAddr string) (attendees []string, err error) {
	pda, err := CheckInsPDA(programID, activityAddr)
	if err != nil {
		return nil, err
	}
	client := rpc.New(rpcURL)
	acc, err := client.GetAccountInfo(context.Background(), pda)
	if err != nil {
		return nil, err
	}
	if acc == nil || acc.Value == nil || len(acc.Value.Data.GetBinary()) < 8 {
		return nil, nil
	}
	data := acc.Value.Data.GetBinary()
	// Anchor 账户：8 字节 discriminator + activity(32) + authority(32) + Vec<Pubkey>: len(4) + 32*n + bump(1)
	const head = 8 + 32 + 32 + 4
	if len(data) < head {
		return nil, nil
	}
	n := binary.LittleEndian.Uint32(data[8+32+32 : head])
	if n > 200 {
		n = 200
	}
	// 每个 Pubkey 32 字节
	for i := uint32(0); i < n; i++ {
		off := head + i*32
		if int(off)+32 > len(data) { // 强制转换为 int
			break
		}
		pubkey := solana.PublicKeyFromBytes(data[int(off) : int(off)+32]) // 同样转换
		attendees = append(attendees, pubkey.String())
	}
	// for i := uint32(0); i < n; i++ {
	// 	off := head + i*32
	// 	if off+32 > len(data) {
	// 		break
	// 	}
	// 	pubkey := solana.PublicKeyFromBytes(data[off : off+32])
	// 	attendees = append(attendees, pubkey.String())
	// }
	return attendees, nil
}

// CandidateVote 链上投票汇总的一项
type CandidateVote struct {
	CandidateID uint64 `json:"candidate_id"`
	VoteCount   uint64 `json:"vote_count"`
}

// FetchVoteTally 从 RPC 获取活动链上投票汇总。account 不存在或未初始化时返回 nil, nil。
func FetchVoteTally(rpcURL, programID, activityAddr string) (counts []CandidateVote, err error) {
	pda, err := VoteTallyPDA(programID, activityAddr)
	if err != nil {
		return nil, err
	}
	client := rpc.New(rpcURL)
	acc, err := client.GetAccountInfo(context.Background(), pda)
	if err != nil {
		return nil, err
	}
	if acc == nil || acc.Value == nil || len(acc.Value.Data.GetBinary()) < 8 {
		return nil, nil
	}
	data := acc.Value.Data.GetBinary()
	// Anchor: 8 + activity(32) + authority(32) + Vec<CandidateVote>: len(4) + (8+8)*n + bump(1)
	const head = 8 + 32 + 32 + 4
	if len(data) < head {
		return nil, nil
	}
	n := binary.LittleEndian.Uint32(data[8+32+32 : head])
	if n > 100 {
		n = 100
	}
	for i := uint32(0); i < n; i++ {
		off := head + i*16
		if int(off)+16 > len(data) { // 转为 int 进行比较
			break
		}
		counts = append(counts, CandidateVote{
			CandidateID: binary.LittleEndian.Uint64(data[int(off) : int(off)+8]),
			VoteCount:   binary.LittleEndian.Uint64(data[int(off)+8 : int(off)+16]),
		})
	}

	// for i := uint32(0); i < n; i++ {
	// 	off := head + i*16
	// 	if off+16 > len(data) {
	// 		break
	// 	}
	// 	counts = append(counts, CandidateVote{
	// 		CandidateID: binary.LittleEndian.Uint64(data[off : off+8]),
	// 		VoteCount:   binary.LittleEndian.Uint64(data[off+8 : off+16]),
	// 	})
	// }
	return counts, nil
}
