//! 链上状态与账户结构定义

use anchor_lang::prelude::*;

#[derive(Clone, AnchorSerialize, AnchorDeserialize, PartialEq, Eq)]
pub enum ActivityPhase {
    Draft,        // 草稿，可删除
    Published,    // 已发布（链上已创建，未进入报名）
    Registration, // 报名中，不可删除
    CheckIn,      // 签到阶段
    TeamFormation, // 组队阶段
    Submission,   // 上传代码阶段
    Voting,       // 投票阶段
    Ended,        // 投票结束/公布结果
}

#[account]
pub struct Activity {
    pub authority: Pubkey,
    pub activity_id: u64,
    pub title: String,
    pub description_hash: [u8; 32],
    pub phase: ActivityPhase,
    pub bump: u8,
    pub created_at: i64,
}

#[account]
pub struct ActivityCheckIns {
    pub activity: Pubkey,
    pub authority: Pubkey,
    pub attendees: Vec<Pubkey>,
    pub bump: u8,
}

#[account]
pub struct VoteRecord {
    pub voter: Pubkey,
    pub activity: Pubkey,
    pub candidate_id: u64,
    pub bump: u8,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct CandidateVote {
    pub candidate_id: u64,
    pub vote_count: u64,
}

#[account]
pub struct VoteTally {
    pub activity: Pubkey,
    pub authority: Pubkey,
    pub counts: Vec<CandidateVote>,
    pub bump: u8,
}

// ---------- 赞助商资金管理 ----------

/// 全局配置：主办方钱包（Admin 绑定）、审核期限等
#[account]
pub struct SponsorConfig {
    /// 有权审核（approve/reject）的账户
    pub authority: Pubkey,
    /// 主办方钱包，审核通过后金额转入此地址
    pub admin_wallet: Pubkey,
    /// 默认审核时间（秒），如 3 小时 = 10800
    pub review_period_secs: u64,
    /// 金库 PDA 的 bump，用于 approve/reject 时 CPI 签名
    pub treasury_bump: u8,
    pub bump: u8,
}

/// 金库 PDA：仅持 SOL、无数据（space=0），以便系统程序能从其转出
/// bump 存在 SponsorConfig.treasury_bump 中

#[derive(Clone, AnchorSerialize, AnchorDeserialize, PartialEq, Eq)]
pub enum SponsorApplicationStatus {
    Pending,
    Approved,
    Rejected,
}

/// 长期赞助商申请：钱存入金库，审核通过转主办方，拒绝则原路返回
#[account]
pub struct SponsorApplication {
    pub sponsor: Pubkey,
    pub amount_lamports: u64,
    pub status: SponsorApplicationStatus,
    pub applied_at: i64,
    pub bump: u8,
}
