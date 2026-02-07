//! 活动生命周期：发布、删除、报名阶段、签到阶段

use anchor_lang::prelude::*;

use crate::error::HackathonError;
use crate::state::{Activity, ActivityPhase};

#[derive(Accounts)]
pub struct Initialize {}

#[derive(Accounts)]
#[instruction(activity_id: u64)]
pub struct PublishActivity<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        init,
        payer = authority,
        space = 8 + 32 + 8 + 4 + 128 + 32 + 1 + 1 + 8,
        seeds = [b"activity", authority.key().as_ref(), &activity_id.to_le_bytes()],
        bump
    )]
    pub activity: Account<'info, Activity>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct DeleteActivity<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        mut,
        close = authority,
        has_one = authority,
        constraint = activity.phase == ActivityPhase::Draft @ HackathonError::CannotDeleteAfterRegistration
    )]
    pub activity: Account<'info, Activity>,
}

#[derive(Accounts)]
pub struct StartRegistration<'info> {
    pub authority: Signer<'info>,

    #[account(
        mut,
        has_one = authority
    )]
    pub activity: Account<'info, Activity>,
}

#[derive(Accounts)]
pub struct StartCheckIn<'info> {
    pub authority: Signer<'info>,

    #[account(
        mut,
        has_one = authority
    )]
    pub activity: Account<'info, Activity>,
}

#[derive(Accounts)]
pub struct StartTeamFormation<'info> {
    pub authority: Signer<'info>,

    #[account(
        mut,
        has_one = authority
    )]
    pub activity: Account<'info, Activity>,
}

#[derive(Accounts)]
pub struct StartSubmission<'info> {
    pub authority: Signer<'info>,

    #[account(
        mut,
        has_one = authority
    )]
    pub activity: Account<'info, Activity>,
}

#[derive(Accounts)]
pub struct StartVoting<'info> {
    pub authority: Signer<'info>,

    #[account(
        mut,
        has_one = authority
    )]
    pub activity: Account<'info, Activity>,
}

#[derive(Accounts)]
pub struct StartResults<'info> {
    pub authority: Signer<'info>,

    #[account(
        mut,
        has_one = authority
    )]
    pub activity: Account<'info, Activity>,
}

pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
    msg!("Greetings from: {:?}", ctx.program_id);
    Ok(())
}

pub fn publish_activity(
    ctx: Context<PublishActivity>,
    activity_id: u64,
    title: String,
    description_hash: [u8; 32],
) -> Result<()> {
    require!(title.len() <= 128, HackathonError::TitleTooLong);
    let activity = &mut ctx.accounts.activity;
    activity.authority = ctx.accounts.authority.key();
    activity.activity_id = activity_id;
    activity.title = title.clone();
    activity.description_hash = description_hash;
    activity.phase = ActivityPhase::Published;
    activity.bump = ctx.bumps.activity;
    activity.created_at = Clock::get()?.unix_timestamp;
    Ok(())
}

pub fn delete_activity(_ctx: Context<DeleteActivity>) -> Result<()> {
    Ok(())
}

pub fn start_registration(ctx: Context<StartRegistration>) -> Result<()> {
    ctx.accounts.activity.phase = ActivityPhase::Registration;
    Ok(())
}

pub fn start_check_in(ctx: Context<StartCheckIn>) -> Result<()> {
    ctx.accounts.activity.phase = ActivityPhase::CheckIn;
    Ok(())
}

pub fn start_team_formation(ctx: Context<StartTeamFormation>) -> Result<()> {
    ctx.accounts.activity.phase = ActivityPhase::TeamFormation;
    Ok(())
}

pub fn start_submission(ctx: Context<StartSubmission>) -> Result<()> {
    ctx.accounts.activity.phase = ActivityPhase::Submission;
    Ok(())
}

pub fn start_voting(ctx: Context<StartVoting>) -> Result<()> {
    ctx.accounts.activity.phase = ActivityPhase::Voting;
    Ok(())
}

pub fn start_results(ctx: Context<StartResults>) -> Result<()> {
    ctx.accounts.activity.phase = ActivityPhase::Ended;
    Ok(())
}
