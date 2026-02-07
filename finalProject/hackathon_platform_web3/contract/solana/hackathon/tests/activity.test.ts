/**
 * 场景：活动数据上链、报名阶段、删除活动
 */
import * as anchor from "@coral-xyz/anchor";
import { expect } from "chai";
import { PublicKey } from "@solana/web3.js";
import type { TestEnv } from "./helpers";

const ACTIVITY_ID = 0;

export function registerActivityTests(env: TestEnv): void {
  const { program, provider, authority, other, activityPda, TITLE, DESCRIPTION_HASH } = env;

  describe("publish_activity", () => {
    it("happy path: 主办方发布活动，活动数据上链", async () => {
      const [activityPdaAddr] = activityPda(authority.publicKey, ACTIVITY_ID);
      await program.methods
        .publishActivity(
          new anchor.BN(ACTIVITY_ID),
          TITLE,
          Array.from(DESCRIPTION_HASH)
        )
        .accounts({
          authority: authority.publicKey,
          activity: activityPdaAddr,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([authority])
        .rpc();

      const activity = await program.account.activity.fetch(activityPdaAddr);
      expect(activity.authority.equals(authority.publicKey)).to.be.true;
      expect(activity.activityId.toNumber()).to.equal(ACTIVITY_ID);
      expect(activity.title).to.equal(TITLE);
      expect(activity.phase.draft !== undefined).to.be.true;
      expect(activity.bump).to.be.a("number");
      expect(activity.createdAt.toNumber()).to.be.greaterThan(0);
    });

    it("fail: title 超过 128 字节", async () => {
      const longTitle = "a".repeat(129);
      const [activityPdaAddr] = activityPda(authority.publicKey, 1);
      try {
        await program.methods
          .publishActivity(
            new anchor.BN(1),
            longTitle,
            Array.from(DESCRIPTION_HASH)
          )
          .accounts({
            authority: authority.publicKey,
            activity: activityPdaAddr,
            systemProgram: anchor.web3.SystemProgram.programId,
          })
          .signers([authority])
          .rpc();
        expect.fail("should have thrown");
      } catch (e: unknown) {
        const err = e as { message?: string; error?: { errorMessage?: string } };
        expect(
          err.message?.includes("TitleTooLong") ||
            err.error?.errorMessage?.includes("128")
        ).to.be.true;
      }
    });

    it("边界: activity_id 使用 u64 大数可正常发布", async () => {
      const bigIdBn = new anchor.BN("9223372036854775807");
      const [activityPdaAddr] = activityPda(authority.publicKey, bigIdBn);
      await program.methods
        .publishActivity(
          bigIdBn,
          "Big ID Activity",
          Array.from(DESCRIPTION_HASH)
        )
        .accounts({
          authority: authority.publicKey,
          activity: activityPdaAddr,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([authority])
        .rpc();
      const activity = await program.account.activity.fetch(activityPdaAddr);
      expect(activity.activityId.toString()).to.equal("9223372036854775807");
    });

    it("fail: 重复初始化同一 activity_id（同一 authority）", async () => {
      const [activityPdaAddr] = activityPda(authority.publicKey, ACTIVITY_ID);
      try {
        await program.methods
          .publishActivity(
            new anchor.BN(ACTIVITY_ID),
            "Another Title",
            Array.from(DESCRIPTION_HASH)
          )
          .accounts({
            authority: authority.publicKey,
            activity: activityPdaAddr,
            systemProgram: anchor.web3.SystemProgram.programId,
          })
          .signers([authority])
          .rpc();
        expect.fail("should have thrown");
      } catch (e: unknown) {
        const err = e as { message?: string };
        expect(
          err.message?.includes("already in use") ||
            err.message?.includes("custom program error")
        ).to.be.true;
      }
    });
  });

  describe("start_registration", () => {
    it("happy path: 活动进入报名阶段", async () => {
      const [activityPdaAddr] = activityPda(authority.publicKey, ACTIVITY_ID);
      await program.methods
        .startRegistration()
        .accounts({
          authority: authority.publicKey,
          activity: activityPdaAddr,
        })
        .signers([authority])
        .rpc();

      const activity = await program.account.activity.fetch(activityPdaAddr);
      expect(activity.phase.registration !== undefined).to.be.true;
    });

    it("fail: 非主办方不能调用 start_registration", async () => {
      const [activityPdaAddr] = activityPda(authority.publicKey, ACTIVITY_ID);
      try {
        await program.methods
          .startRegistration()
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

  describe("delete_activity (已进入报名阶段)", () => {
    it("fail: 活动进入报名阶段后不可删除", async () => {
      const [activityPdaAddr] = activityPda(authority.publicKey, ACTIVITY_ID);
      try {
        await program.methods
          .deleteActivity()
          .accounts({
            authority: authority.publicKey,
            activity: activityPdaAddr,
          })
          .signers([authority])
          .rpc();
        expect.fail("should have thrown");
      } catch (e: unknown) {
        const err = e as { message?: string; error?: { errorMessage?: string } };
        expect(
          err.message?.includes("CannotDeleteAfterRegistration") ||
            err.error?.errorMessage?.includes("cannot be deleted")
        ).to.be.true;
      }
    });
  });

  describe("delete_activity (Draft 阶段)", () => {
    let activityPdaAddr: PublicKey;

    before(async () => {
      const id = 100;
      const [pda] = activityPda(authority.publicKey, id);
      activityPdaAddr = pda;
      await program.methods
        .publishActivity(new anchor.BN(id), "To Be Deleted", Array.from(DESCRIPTION_HASH))
        .accounts({
          authority: authority.publicKey,
          activity: activityPdaAddr,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([authority])
        .rpc();
    });

    it("happy path: Draft 阶段删除活动，账户关闭，rent 退还给 authority", async () => {
      const beforeBalance = await provider.connection.getBalance(authority.publicKey);
      await program.methods
        .deleteActivity()
        .accounts({
          authority: authority.publicKey,
          activity: activityPdaAddr,
        })
        .signers([authority])
        .rpc();
      const afterBalance = await provider.connection.getBalance(authority.publicKey);
      expect(afterBalance).to.be.greaterThan(beforeBalance);

      try {
        await program.account.activity.fetch(activityPdaAddr);
        expect.fail("account should be closed");
      } catch (e: unknown) {
        const err = e as { message?: string };
        expect(err.message?.toLowerCase()).to.match(/account does not exist|could not find account/i);
      }
    });

    it("fail: 非主办方不能删除活动", async () => {
      const [pda] = activityPda(authority.publicKey, 101);
      await program.methods
        .publishActivity(new anchor.BN(101), "Other Delete Test", Array.from(DESCRIPTION_HASH))
        .accounts({
          authority: authority.publicKey,
          activity: pda,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([authority])
        .rpc();

      try {
        await program.methods
          .deleteActivity()
          .accounts({
            authority: other.publicKey,
            activity: pda,
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
}
