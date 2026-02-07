/**
 * 场景：投票、撤销投票、投票汇总上链
 */
import * as anchor from "@coral-xyz/anchor";
import { expect } from "chai";
import { PublicKey } from "@solana/web3.js";
import type { TestEnv } from "./helpers";

const ACTIVITY_ID_CHECKIN = 2;

export function registerVoteTests(env: TestEnv): void {
  const {
    program,
    provider,
    authority,
    other,
    activityPda,
    checkInsPda,
    voteRecordPda,
    voteTallyPda,
    DESCRIPTION_HASH,
  } = env;

  describe("vote", () => {
    it("happy path: 签到名单中的用户可投票", async () => {
      const [activityPdaAddr] = activityPda(authority.publicKey, ACTIVITY_ID_CHECKIN);
      const [checkInsPdaAddr] = checkInsPda(activityPdaAddr);
      const [voteRecordPdaAddr] = voteRecordPda(activityPdaAddr, other.publicKey);
      const candidateId = 1;

      await program.methods
        .vote(new anchor.BN(candidateId))
        .accounts({
          voter: other.publicKey,
          activity: activityPdaAddr,
          checkIns: checkInsPdaAddr,
          voteRecord: voteRecordPdaAddr,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([other])
        .rpc();

      const voteRecord = await program.account.voteRecord.fetch(voteRecordPdaAddr);
      expect(voteRecord.voter.equals(other.publicKey)).to.be.true;
      expect(voteRecord.activity.equals(activityPdaAddr)).to.be.true;
      expect(voteRecord.candidateId.toNumber()).to.equal(candidateId);
    });

    it("fail: 非签到人员不能投票", async () => {
      const stranger = anchor.web3.Keypair.generate();
      const sig = await provider.connection.requestAirdrop(
        stranger.publicKey,
        anchor.web3.LAMPORTS_PER_SOL
      );
      await provider.connection.confirmTransaction(sig);

      const [activityPdaAddr] = activityPda(authority.publicKey, ACTIVITY_ID_CHECKIN);
      const [checkInsPdaAddr] = checkInsPda(activityPdaAddr);
      const [voteRecordPdaAddr] = voteRecordPda(activityPdaAddr, stranger.publicKey);

      try {
        await program.methods
          .vote(new anchor.BN(1))
          .accounts({
            voter: stranger.publicKey,
            activity: activityPdaAddr,
            checkIns: checkInsPdaAddr,
            voteRecord: voteRecordPdaAddr,
            systemProgram: anchor.web3.SystemProgram.programId,
          })
          .signers([stranger])
          .rpc();
        expect.fail("should have thrown");
      } catch (e: unknown) {
        const err = e as { message?: string; error?: { errorMessage?: string } };
        expect(
          err.message?.includes("NotInCheckInList") ||
            err.error?.errorMessage?.toLowerCase().includes("check-in")
        ).to.be.true;
      }
    });

    it("fail: 投票阶段结束后不能投票（先上传 tally 进入 Ended）", async () => {
      const id = 9;
      const [activityPdaAddr] = activityPda(authority.publicKey, id);
      const [checkInsPdaAddr] = checkInsPda(activityPdaAddr);
      const [voteTallyPdaAddr] = voteTallyPda(activityPdaAddr);
      await program.methods
        .publishActivity(new anchor.BN(id), "Vote Phase Test", Array.from(DESCRIPTION_HASH))
        .accounts({
          authority: authority.publicKey,
          activity: activityPdaAddr,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([authority])
        .rpc();
      await program.methods
        .startRegistration()
        .accounts({ authority: authority.publicKey, activity: activityPdaAddr })
        .signers([authority])
        .rpc();
      await program.methods
        .startCheckIn()
        .accounts({ authority: authority.publicKey, activity: activityPdaAddr })
        .signers([authority])
        .rpc();
      await program.methods
        .uploadCheckIns([authority.publicKey])
        .accounts({
          authority: authority.publicKey,
          activity: activityPdaAddr,
          checkIns: checkInsPdaAddr,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([authority])
        .rpc();
      await program.methods
        .startTeamFormation()
        .accounts({ authority: authority.publicKey, activity: activityPdaAddr })
        .signers([authority])
        .rpc();
      await program.methods
        .startSubmission()
        .accounts({ authority: authority.publicKey, activity: activityPdaAddr })
        .signers([authority])
        .rpc();
      await program.methods
        .startVoting()
        .accounts({ authority: authority.publicKey, activity: activityPdaAddr })
        .signers([authority])
        .rpc();
      await program.methods
        .uploadVoteTally([new anchor.BN(1)], [new anchor.BN(10)])
        .accounts({
          authority: authority.publicKey,
          activity: activityPdaAddr,
          voteTally: voteTallyPdaAddr,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([authority])
        .rpc();

      const [voteRecordPdaAddr] = voteRecordPda(activityPdaAddr, authority.publicKey);
      try {
        await program.methods
          .vote(new anchor.BN(1))
          .accounts({
            voter: authority.publicKey,
            activity: activityPdaAddr,
            checkIns: checkInsPdaAddr,
            voteRecord: voteRecordPdaAddr,
            systemProgram: anchor.web3.SystemProgram.programId,
          })
          .signers([authority])
          .rpc();
        expect.fail("should have thrown");
      } catch (e: unknown) {
        const err = e as { message?: string; error?: { errorMessage?: string } };
        expect(
          err.message?.includes("InvalidPhaseForVote") ||
            err.error?.errorMessage?.toLowerCase().includes("voting")
        ).to.be.true;
      }
    });
  });

  describe("revoke_vote", () => {
    it("happy path: 签到名单中的用户可撤销投票", async () => {
      const [activityPdaAddr] = activityPda(authority.publicKey, ACTIVITY_ID_CHECKIN);
      const [checkInsPdaAddr] = checkInsPda(activityPdaAddr);
      const [voteRecordPdaAddr] = voteRecordPda(activityPdaAddr, other.publicKey);

      await program.methods
        .revokeVote()
        .accounts({
          voter: other.publicKey,
          activity: activityPdaAddr,
          checkIns: checkInsPdaAddr,
          voteRecord: voteRecordPdaAddr,
        })
        .signers([other])
        .rpc();

      try {
        await program.account.voteRecord.fetch(voteRecordPdaAddr);
        expect.fail("vote record should be closed");
      } catch (e: unknown) {
        const err = e as { message?: string };
        expect(err.message?.toLowerCase()).to.match(/account does not exist|could not find account/i);
      }
    });

    it("fail: 非签到人员不能撤销投票", async () => {
      const stranger = anchor.web3.Keypair.generate();
      const sig = await provider.connection.requestAirdrop(
        stranger.publicKey,
        anchor.web3.LAMPORTS_PER_SOL
      );
      await provider.connection.confirmTransaction(sig);

      const id = 5;
      const [activityPdaAddr] = activityPda(authority.publicKey, id);
      await program.methods
        .publishActivity(new anchor.BN(id), "Revoke Test", Array.from(DESCRIPTION_HASH))
        .accounts({
          authority: authority.publicKey,
          activity: activityPdaAddr,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([authority])
        .rpc();
      await program.methods
        .startRegistration()
        .accounts({ authority: authority.publicKey, activity: activityPdaAddr })
        .signers([authority])
        .rpc();
      await program.methods
        .startCheckIn()
        .accounts({ authority: authority.publicKey, activity: activityPdaAddr })
        .signers([authority])
        .rpc();
      const [checkInsPdaAddr] = checkInsPda(activityPdaAddr);
      await program.methods
        .uploadCheckIns([authority.publicKey])
        .accounts({
          authority: authority.publicKey,
          activity: activityPdaAddr,
          checkIns: checkInsPdaAddr,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([authority])
        .rpc();
      await program.methods
        .startTeamFormation()
        .accounts({ authority: authority.publicKey, activity: activityPdaAddr })
        .signers([authority])
        .rpc();
      await program.methods
        .startSubmission()
        .accounts({ authority: authority.publicKey, activity: activityPdaAddr })
        .signers([authority])
        .rpc();
      await program.methods
        .startVoting()
        .accounts({ authority: authority.publicKey, activity: activityPdaAddr })
        .signers([authority])
        .rpc();
      const [voteRecordPdaAddr] = voteRecordPda(activityPdaAddr, stranger.publicKey);
      try {
        await program.methods
          .revokeVote()
          .accounts({
            voter: stranger.publicKey,
            activity: activityPdaAddr,
            checkIns: checkInsPdaAddr,
            voteRecord: voteRecordPdaAddr,
          })
          .signers([stranger])
          .rpc();
        expect.fail("should have thrown");
      } catch (e: unknown) {
        const err = e as { message?: string };
        expect(
          err.message?.includes("NotInCheckInList") ||
            err.message?.includes("constraint") ||
            err.message?.includes("AccountNotInitialized")
        ).to.be.true;
      }
    });
  });

  describe("upload_vote_tally", () => {
    it("happy path: 投票阶段结束后将投票汇总上链，活动进入 Ended", async () => {
      const id = 6;
      const [activityPdaAddr] = activityPda(authority.publicKey, id);
      await program.methods
        .publishActivity(new anchor.BN(id), "Tally Activity", Array.from(DESCRIPTION_HASH))
        .accounts({
          authority: authority.publicKey,
          activity: activityPdaAddr,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([authority])
        .rpc();
      await program.methods
        .startRegistration()
        .accounts({ authority: authority.publicKey, activity: activityPdaAddr })
        .signers([authority])
        .rpc();
      await program.methods
        .startCheckIn()
        .accounts({ authority: authority.publicKey, activity: activityPdaAddr })
        .signers([authority])
        .rpc();
      const [checkInsPdaAddr] = checkInsPda(activityPdaAddr);
      await program.methods
        .uploadCheckIns([authority.publicKey, other.publicKey])
        .accounts({
          authority: authority.publicKey,
          activity: activityPdaAddr,
          checkIns: checkInsPdaAddr,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([authority])
        .rpc();

      await program.methods
        .startTeamFormation()
        .accounts({ authority: authority.publicKey, activity: activityPdaAddr })
        .signers([authority])
        .rpc();
      await program.methods
        .startSubmission()
        .accounts({ authority: authority.publicKey, activity: activityPdaAddr })
        .signers([authority])
        .rpc();
      await program.methods
        .startVoting()
        .accounts({ authority: authority.publicKey, activity: activityPdaAddr })
        .signers([authority])
        .rpc();

      const [voteTallyPdaAddr] = voteTallyPda(activityPdaAddr);
      await program.methods
        .uploadVoteTally(
          [1, 2, 3].map((n) => new anchor.BN(n)),
          [100, 200, 50].map((n) => new anchor.BN(n))
        )
        .accounts({
          authority: authority.publicKey,
          activity: activityPdaAddr,
          voteTally: voteTallyPdaAddr,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([authority])
        .rpc();

      const tally = await program.account.voteTally.fetch(voteTallyPdaAddr);
      expect(tally.activity.equals(activityPdaAddr)).to.be.true;
      expect(tally.counts.length).to.equal(3);
      expect(tally.counts[0].candidateId.toNumber()).to.equal(1);
      expect(tally.counts[0].voteCount.toNumber()).to.equal(100);

      const activity = await program.account.activity.fetch(activityPdaAddr);
      expect(activity.phase.ended !== undefined).to.be.true;
    });

    it("fail: 非投票阶段不能上传 tally（仍为 CheckIn，未上传签到名单）", async () => {
      const id = 7;
      const [activityPdaAddr] = activityPda(authority.publicKey, id);
      const [voteTallyPdaAddr] = voteTallyPda(activityPdaAddr);
      await program.methods
        .publishActivity(new anchor.BN(id), "Tally Phase Test", Array.from(DESCRIPTION_HASH))
        .accounts({
          authority: authority.publicKey,
          activity: activityPdaAddr,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([authority])
        .rpc();
      await program.methods
        .startRegistration()
        .accounts({ authority: authority.publicKey, activity: activityPdaAddr })
        .signers([authority])
        .rpc();
      await program.methods
        .startCheckIn()
        .accounts({ authority: authority.publicKey, activity: activityPdaAddr })
        .signers([authority])
        .rpc();
      try {
        await program.methods
          .uploadVoteTally([new anchor.BN(1)], [new anchor.BN(10)])
          .accounts({
            authority: authority.publicKey,
            activity: activityPdaAddr,
            voteTally: voteTallyPdaAddr,
            systemProgram: anchor.web3.SystemProgram.programId,
          })
          .signers([authority])
          .rpc();
        expect.fail("should have thrown");
      } catch (e: unknown) {
        const err = e as { message?: string };
        expect(
          err.message?.includes("InvalidPhaseForTally") ||
            err.message?.includes("InvalidPhase") ||
            err.message?.includes("constraint")
        ).to.be.true;
      }
    });

    it("fail: candidate_ids 与 vote_counts 长度不一致", async () => {
      const id = 8;
      const [activityPdaAddr] = activityPda(authority.publicKey, id);
      const [checkInsPdaAddr] = checkInsPda(activityPdaAddr);
      const [voteTallyPdaAddr] = voteTallyPda(activityPdaAddr);
      await program.methods
        .publishActivity(new anchor.BN(id), "Tally Mismatch", Array.from(DESCRIPTION_HASH))
        .accounts({
          authority: authority.publicKey,
          activity: activityPdaAddr,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([authority])
        .rpc();
      await program.methods
        .startRegistration()
        .accounts({ authority: authority.publicKey, activity: activityPdaAddr })
        .signers([authority])
        .rpc();
      await program.methods
        .startCheckIn()
        .accounts({ authority: authority.publicKey, activity: activityPdaAddr })
        .signers([authority])
        .rpc();
      await program.methods
        .uploadCheckIns([authority.publicKey])
        .accounts({
          authority: authority.publicKey,
          activity: activityPdaAddr,
          checkIns: checkInsPdaAddr,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([authority])
        .rpc();
      await program.methods
        .startTeamFormation()
        .accounts({ authority: authority.publicKey, activity: activityPdaAddr })
        .signers([authority])
        .rpc();
      await program.methods
        .startSubmission()
        .accounts({ authority: authority.publicKey, activity: activityPdaAddr })
        .signers([authority])
        .rpc();
      await program.methods
        .startVoting()
        .accounts({ authority: authority.publicKey, activity: activityPdaAddr })
        .signers([authority])
        .rpc();
      try {
        await program.methods
          .uploadVoteTally(
            [new anchor.BN(1), new anchor.BN(2)],
            [new anchor.BN(10)]
          )
          .accounts({
            authority: authority.publicKey,
            activity: activityPdaAddr,
            voteTally: voteTallyPdaAddr,
            systemProgram: anchor.web3.SystemProgram.programId,
          })
          .signers([authority])
          .rpc();
        expect.fail("should have thrown");
      } catch (e: unknown) {
        const err = e as { message?: string; error?: { errorMessage?: string } };
        expect(
          err.message?.includes("TallyLengthMismatch") ||
            err.error?.errorMessage?.toLowerCase().includes("mismatch")
        ).to.be.true;
      }
    });
  });
}
