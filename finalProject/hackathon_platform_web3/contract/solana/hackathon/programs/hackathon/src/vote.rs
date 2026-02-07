//! 投票与投票汇总上链

use anchor_lang::prelude::*;

use crate::error::HackathonError;
use crate::state::{Activity, ActivityCheckIns, CandidateVote, VoteRecord, VoteTally, ActivityPhase};

#[derive(Accounts)]
pub struct CastVote<'info> {
    #[account(mut)]
    pub voter: Signer<'info>,

    #[account(
        mut,
        constraint = activity.phase == ActivityPhase::Voting @ HackathonError::InvalidPhaseForVote
    )]
    pub activity: Account<'info, Activity>,

    #[account(
        has_one = activity,
        seeds = [b"check_ins", activity.key().as_ref()],
        bump = check_ins.bump
    )]
    pub check_ins: Account<'info, ActivityCheckIns>,

    #[account(
        init,
        payer = voter,
        space = 8 + 32 + 32 + 8 + 1,
        seeds = [b"vote", activity.key().as_ref(), voter.key().as_ref()],
        bump
    )]
    pub vote_record: Account<'info, VoteRecord>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct RevokeVote<'info> {
    #[account(mut)]
    pub voter: Signer<'info>,

    #[account(
        mut,
        constraint = activity.phase == ActivityPhase::Voting @ HackathonError::InvalidPhaseForVote
    )]
    pub activity: Account<'info, Activity>,

    #[account(
        has_one = activity,
        seeds = [b"check_ins", activity.key().as_ref()],
        bump = check_ins.bump
    )]
    pub check_ins: Account<'info, ActivityCheckIns>,

    #[account(
        mut,
        close = voter,
        has_one = voter,
        has_one = activity
    )]
    pub vote_record: Account<'info, VoteRecord>,
}

#[derive(Accounts)]
pub struct UploadVoteTally<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        mut,
        has_one = authority,
        constraint = activity.phase == ActivityPhase::Voting @ HackathonError::InvalidPhaseForTally
    )]
    pub activity: Account<'info, Activity>,

    #[account(
        init,
        payer = authority,
        space = 8 + 32 + 32 + 4 + (100 * (8 + 8)) + 1,
        seeds = [b"vote_tally", activity.key().as_ref()],
        bump
    )]
    pub vote_tally: Account<'info, VoteTally>,

    pub system_program: Program<'info, System>,
}

pub fn vote(ctx: Context<CastVote>, candidate_id: u64) -> Result<()> {
    let check_ins = &ctx.accounts.check_ins;
    let voter = ctx.accounts.voter.key();
    require!(
        check_ins.attendees.contains(&voter),
        HackathonError::NotInCheckInList
    );
    let v = &mut ctx.accounts.vote_record;
    v.voter = voter;
    v.activity = ctx.accounts.activity.key();
    v.candidate_id = candidate_id;
    v.bump = ctx.bumps.vote_record;
    Ok(())
}

pub fn revoke_vote(ctx: Context<RevokeVote>) -> Result<()> {
    let check_ins = &ctx.accounts.check_ins;
    let voter = ctx.accounts.voter.key();
    require!(
        check_ins.attendees.contains(&voter),
        HackathonError::NotInCheckInList
    );
    Ok(())
}

pub fn upload_vote_tally(
    ctx: Context<UploadVoteTally>,
    candidate_ids: Vec<u64>,
    vote_counts: Vec<u64>,
) -> Result<()> {
    require!(
        candidate_ids.len() == vote_counts.len(),
        HackathonError::TallyLengthMismatch
    );
    require!(
        candidate_ids.len() <= 100,
        HackathonError::TallyTooLong
    );
    let tally = &mut ctx.accounts.vote_tally;
    tally.activity = ctx.accounts.activity.key();
    tally.authority = ctx.accounts.authority.key();
    tally.counts = candidate_ids
        .into_iter()
        .zip(vote_counts.into_iter())
        .map(|(candidate_id, vote_count)| CandidateVote {
            candidate_id,
            vote_count,
        })
        .collect();
    tally.bump = ctx.bumps.vote_tally;
    ctx.accounts.activity.phase = ActivityPhase::Ended;
    Ok(())
}
