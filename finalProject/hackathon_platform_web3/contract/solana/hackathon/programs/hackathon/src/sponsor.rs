//! 赞助商资金管理：长期赞助商申请入金库，审核通过转主办方，拒绝原路返回

use anchor_lang::prelude::*;
use anchor_lang::system_program;

use anchor_lang::solana_program::system_instruction;

use crate::error::HackathonError;
use crate::state::{SponsorApplication, SponsorApplicationStatus, SponsorConfig};

/// 初始化赞助商全局配置与金库。审核期限默认建议 3 小时（10800 秒），可在项目配置中设置。
/// 金库为无数据 PDA (space=0)，仅持 SOL，以便系统程序能从其转出。
pub fn initialize_sponsor_config(
    ctx: Context<InitializeSponsorConfig>,
    admin_wallet: Pubkey,
    review_period_secs: u64,
) -> Result<()> {
    let (treasury_pda, treasury_bump) =
        Pubkey::find_program_address(&[b"treasury"], ctx.program_id);
    require!(
        ctx.accounts.treasury.key() == treasury_pda,
        HackathonError::InvalidTreasury
    );

    let config = &mut ctx.accounts.config;
    config.authority = ctx.accounts.authority.key();
    config.admin_wallet = admin_wallet;
    config.review_period_secs = review_period_secs;
    config.treasury_bump = treasury_bump;
    config.bump = ctx.bumps.config;

    // 金库须为 System Program 拥有，System Program 才能从其转出 SOL；仅本程序可通过 invoke_signed 用 PDA 签名授权转出
    if *ctx.accounts.treasury.owner != anchor_lang::solana_program::system_program::ID {
        let rent = Rent::get()?;
        let create_ix = system_instruction::create_account(
            &ctx.accounts.authority.key(),
            &ctx.accounts.treasury.key(),
            rent.minimum_balance(0),
            0,
            &anchor_lang::solana_program::system_program::ID,
        );
        let seeds: &[&[u8]] = &[b"treasury", &[treasury_bump]];
        let signer_seeds = &[seeds];
        anchor_lang::solana_program::program::invoke_signed(
            &create_ix,
            &[
                ctx.accounts.authority.to_account_info(),
                ctx.accounts.treasury.to_account_info(),
                ctx.accounts.system_program.to_account_info(),
            ],
            signer_seeds,
        )?;
    }
    Ok(())
}

/// 长期赞助商发起申请：将金额转入金库并创建申请记录。
pub fn sponsor_apply(
    ctx: Context<SponsorApply>,
    _application_id: u64,
    amount_lamports: u64,
) -> Result<()> {
    require!(amount_lamports > 0, HackathonError::ZeroAmount);

    let transfer_ix = anchor_lang::solana_program::system_instruction::transfer(
        &ctx.accounts.sponsor.key(),
        &ctx.accounts.treasury.key(),
        amount_lamports,
    );
    anchor_lang::solana_program::program::invoke_signed(
        &transfer_ix,
        &[
            ctx.accounts.sponsor.to_account_info(),
            ctx.accounts.treasury.to_account_info(),
        ],
        &[],
    )?;

    let app = &mut ctx.accounts.application;
    app.sponsor = ctx.accounts.sponsor.key();
    app.amount_lamports = amount_lamports;
    app.status = SponsorApplicationStatus::Pending;
    app.applied_at = Clock::get()?.unix_timestamp;
    app.bump = ctx.bumps.application;
    Ok(())
}

/// 审核通过：将金库中该申请金额转入主办方钱包（Admin 绑定）。
pub fn approve_sponsor(ctx: Context<ReviewSponsor>, _application_id: u64) -> Result<()> {
    let app = &ctx.accounts.application;
    require!(
        app.status == SponsorApplicationStatus::Pending,
        HackathonError::ApplicationNotPending
    );

    let treasury_bump = ctx.accounts.config.treasury_bump;
    let seeds: &[&[u8]] = &[b"treasury", &[treasury_bump]];
    let signer_seeds = &[seeds];

    let transfer_ix = system_program::Transfer {
        from: ctx.accounts.treasury.to_account_info(),
        to: ctx.accounts.admin_wallet.to_account_info(),
    };
    let cpi_ctx = CpiContext::new_with_signer(
        ctx.accounts.system_program.to_account_info(),
        transfer_ix,
        signer_seeds,
    );
    system_program::transfer(cpi_ctx, app.amount_lamports)?;

    let app_mut = &mut ctx.accounts.application;
    app_mut.status = SponsorApplicationStatus::Approved;
    Ok(())
}

/// 审核失败：金额原路返回给赞助商。
pub fn reject_sponsor(ctx: Context<ReviewSponsor>, _application_id: u64) -> Result<()> {
    let app = &ctx.accounts.application;
    require!(
        app.status == SponsorApplicationStatus::Pending,
        HackathonError::ApplicationNotPending
    );

    let treasury_bump = ctx.accounts.config.treasury_bump;
    let seeds: &[&[u8]] = &[b"treasury", &[treasury_bump]];
    let signer_seeds = &[seeds];

    let transfer_ix = system_program::Transfer {
        from: ctx.accounts.treasury.to_account_info(),
        to: ctx.accounts.sponsor_wallet.to_account_info(),
    };
    let cpi_ctx = CpiContext::new_with_signer(
        ctx.accounts.system_program.to_account_info(),
        transfer_ix,
        signer_seeds,
    );
    system_program::transfer(cpi_ctx, app.amount_lamports)?;

    let app_mut = &mut ctx.accounts.application;
    app_mut.status = SponsorApplicationStatus::Rejected;
    Ok(())
}

#[derive(Accounts)]
pub struct InitializeSponsorConfig<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        init,
        payer = authority,
        space = 8 + 32 + 32 + 8 + 1 + 1,
        seeds = [b"config"],
        bump
    )]
    pub config: Account<'info, SponsorConfig>,

    /// 金库 PDA (seeds = [b"treasury"])，本指令内用 CPI 创建为 space=0，仅持 SOL
    /// CHECK: 由 instruction 内校验地址为 PDA
    #[account(mut)]
    pub treasury: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(application_id: u64)]
pub struct SponsorApply<'info> {
    #[account(mut)]
    pub sponsor: Signer<'info>,

    #[account(seeds = [b"config"], bump = config.bump)]
    pub config: Account<'info, SponsorConfig>,

    /// 金库 PDA，仅接收 SOL（无数据）
    /// CHECK: 由 seeds + config.treasury_bump 约束
    #[account(mut, seeds = [b"treasury"], bump = config.treasury_bump)]
    pub treasury: UncheckedAccount<'info>,

    #[account(
        init,
        payer = sponsor,
        space = 8 + 32 + 8 + 1 + 8 + 1,
        seeds = [b"sponsor_application", application_id.to_le_bytes().as_ref()],
        bump
    )]
    pub application: Account<'info, SponsorApplication>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(application_id: u64)]
pub struct ReviewSponsor<'info> {
    pub authority: Signer<'info>,

    #[account(
        seeds = [b"config"],
        bump = config.bump,
        has_one = authority @ HackathonError::NotConfigAuthority
    )]
    pub config: Account<'info, SponsorConfig>,

    /// 金库 PDA (无数据)，转出用 config.treasury_bump 签名
    /// CHECK: seeds 约束
    #[account(mut, seeds = [b"treasury"], bump = config.treasury_bump)]
    pub treasury: UncheckedAccount<'info>,

    #[account(
        mut,
        seeds = [b"sponsor_application", application_id.to_le_bytes().as_ref()],
        bump = application.bump
    )]
    pub application: Account<'info, SponsorApplication>,

    /// 主办方钱包，审核通过时接收金额，必须与 config.admin_wallet 一致
    /// CHECK: 由 constraint 与 config 约束
    #[account(
        mut,
        constraint = admin_wallet.key() == config.admin_wallet
    )]
    pub admin_wallet: AccountInfo<'info>,

    /// 赞助商钱包，拒绝时原路返回
    /// CHECK: 必须与 application.sponsor 一致，由 constraint 校验
    #[account(
        mut,
        constraint = sponsor_wallet.key() == application.sponsor @ HackathonError::SponsorWalletMismatch
    )]
    pub sponsor_wallet: AccountInfo<'info>,

    pub system_program: Program<'info, System>,
}
