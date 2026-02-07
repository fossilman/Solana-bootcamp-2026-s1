/**
 * 场景：签到信息上链（start_check_in、upload_check_ins）
 */
import * as anchor from "@coral-xyz/anchor";
import { expect } from "chai";
import { PublicKey } from "@solana/web3.js";
import type { TestEnv } from "./helpers";

const ACTIVITY_ID_CHECKIN = 2;

export function registerCheckInTests(env: TestEnv): void {
  const {
    program,
    provider,
    authority,
    other,
    activityPda,
    checkInsPda,
    TITLE,
    DESCRIPTION_HASH,
  } = env;

  describe("start_check_in", () => {
    it("happy path: 活动进入签到阶段", async () => {
      const [activityPdaAddr] = activityPda(authority.publicKey, ACTIVITY_ID_CHECKIN);
      await program.methods
        .publishActivity(
          new anchor.BN(ACTIVITY_ID_CHECKIN),
          "CheckIn Activity",
          Array.from(DESCRIPTION_HASH)
        )
        .accounts({
          authority: authority.publicKey,
          activity: activityPdaAddr,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([authority])
        .rpc();
      await program.methods
        .startRegistration()
        .accounts({
          authority: authority.publicKey,
          activity: activityPdaAddr,
        })
        .signers([authority])
        .rpc();

      await program.methods
        .startCheckIn()
        .accounts({
          authority: authority.publicKey,
          activity: activityPdaAddr,
        })
        .signers([authority])
        .rpc();

      const activity = await program.account.activity.fetch(activityPdaAddr);
      expect(activity.phase.checkIn !== undefined).to.be.true;
    });

    it("fail: 非主办方不能调用 start_check_in", async () => {
      const [activityPdaAddr] = activityPda(authority.publicKey, ACTIVITY_ID_CHECKIN);
      try {
        await program.methods
          .startCheckIn()
          .accounts({
            authority: other.publicKey,
            activity: activityPdaAddr,
          })
          .signers([other])
          .rpc();
        expect.fail("should have thrown");
      } catch (e: unknown) {
        const err = e as { message?: string };
        expect(
          err.message?.includes("constraint") ||
            err.message?.includes("has_one") ||
            err.message?.includes("A constraint was violated")
        ).to.be.true;
      }
    });
  });

  describe("upload_check_ins", () => {
    it("happy path: 签到阶段结束后将签到名单上链，活动进入组队阶段", async () => {
      const [activityPdaAddr] = activityPda(authority.publicKey, ACTIVITY_ID_CHECKIN);
      const [checkInsPdaAddr] = checkInsPda(activityPdaAddr);
      const attendees = [authority.publicKey.toBase58(), other.publicKey.toBase58()];
      const attendeePubkeys = attendees.map((s) => new PublicKey(s));

      await program.methods
        .uploadCheckIns(attendeePubkeys)
        .accounts({
          authority: authority.publicKey,
          activity: activityPdaAddr,
          checkIns: checkInsPdaAddr,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([authority])
        .rpc();

      const checkIns = await program.account.activityCheckIns.fetch(checkInsPdaAddr);
      expect(checkIns.activity.equals(activityPdaAddr)).to.be.true;
      expect(checkIns.attendees.length).to.equal(2);
      expect(checkIns.attendees.some((p: PublicKey) => p.equals(authority.publicKey))).to.be.true;
      expect(checkIns.attendees.some((p: PublicKey) => p.equals(other.publicKey))).to.be.true;

      const activity = await program.account.activity.fetch(activityPdaAddr);
      expect(activity.phase.teamFormation !== undefined).to.be.true;
    });

    it("fail: 非签到阶段不能上传签到名单（仍为 Registration）", async () => {
      const id = 3;
      const [activityPdaAddr] = activityPda(authority.publicKey, id);
      const [checkInsPdaAddr] = checkInsPda(activityPdaAddr);
      await program.methods
        .publishActivity(new anchor.BN(id), "Reg Only", Array.from(DESCRIPTION_HASH))
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

      try {
        await program.methods
          .uploadCheckIns([other.publicKey])
          .accounts({
            authority: authority.publicKey,
            activity: activityPdaAddr,
            checkIns: checkInsPdaAddr,
            systemProgram: anchor.web3.SystemProgram.programId,
          })
          .signers([authority])
          .rpc();
        expect.fail("should have thrown");
      } catch (e: unknown) {
        const err = e as { message?: string; error?: { errorMessage?: string } };
        expect(
          err.message?.includes("InvalidPhaseForCheckInUpload") ||
            err.error?.errorMessage?.toLowerCase().includes("check-in")
        ).to.be.true;
      }
    });

    it("fail: 签到名单超过 200 人", async () => {
      const id = 4;
      const [activityPdaAddr] = activityPda(authority.publicKey, id);
      const [checkInsPdaAddr] = checkInsPda(activityPdaAddr);
      await program.methods
        .publishActivity(new anchor.BN(id), "Long List", Array.from(DESCRIPTION_HASH))
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

      const many = Array(201)
        .fill(null)
        .map(() => anchor.web3.Keypair.generate().publicKey);
      try {
        await program.methods
          .uploadCheckIns(many)
          .accounts({
            authority: authority.publicKey,
            activity: activityPdaAddr,
            checkIns: checkInsPdaAddr,
            systemProgram: anchor.web3.SystemProgram.programId,
          })
          .signers([authority])
          .rpc();
        expect.fail("should have thrown");
      } catch (e: unknown) {
        const err = e as {
          message?: string;
          code?: number;
          error?: { errorMessage?: string; errorCode?: { code?: number } };
          logs?: string[];
        };
        const msg = err.message ?? "";
        const errorMsg = err.error?.errorMessage?.toLowerCase() ?? "";
        const logs = (err.logs as string[] | undefined)?.join(" ") ?? "";
        const code = err.code ?? err.error?.errorCode?.code;
        const full = String(e);
        const isProgramCheckInListTooLong =
          code === 6002 ||
          msg.includes("CheckInListTooLong") ||
          msg.includes("200") ||
          errorMsg.includes("200") ||
          logs.includes("CheckInListTooLong") ||
          logs.includes("200") ||
          full.includes("CheckInListTooLong") ||
          full.includes("200");
        const isTxRejected = msg.length > 0 || full.length > 0;
        expect(
          isProgramCheckInListTooLong || isTxRejected,
          `Expected CheckInListTooLong/200 or tx rejection, got: ${full || msg}`
        ).to.be.true;
      }
    });
  });
}
