//! 程序错误码

use anchor_lang::prelude::*;

#[error_code]
pub enum HackathonError {
    #[msg("Title must be at most 128 bytes")]
    TitleTooLong,
    #[msg("Activity cannot be deleted after registration has started")]
    CannotDeleteAfterRegistration,
    #[msg("Check-in list must be at most 200 attendees")]
    CheckInListTooLong,
    #[msg("Only check-in phase allows uploading check-in list")]
    InvalidPhaseForCheckInUpload,
    #[msg("Voter is not in check-in list")]
    NotInCheckInList,
    #[msg("Only voting phase allows vote/revoke")]
    InvalidPhaseForVote,
    #[msg("Tally must be at most 100 entries")]
    TallyTooLong,
    #[msg("Only voting phase allows uploading tally")]
    InvalidPhaseForTally,
    #[msg("Candidate IDs and vote counts length mismatch")]
    TallyLengthMismatch,
    // 赞助商资金管理
    #[msg("Sponsor config already initialized")]
    ConfigAlreadyInitialized,
    #[msg("Only config authority can approve or reject")]
    NotConfigAuthority,
    #[msg("Application is not in Pending status")]
    ApplicationNotPending,
    #[msg("Sponsor application amount must be greater than zero")]
    ZeroAmount,
    #[msg("Sponsor wallet account does not match application")]
    SponsorWalletMismatch,
    #[msg("Invalid treasury PDA")]
    InvalidTreasury,
}
