/**
 * 场景：赞助商资金管理 - 长期赞助商申请入金库，审核通过转主办方，拒绝原路返回
 * 规范：tpl/solana_test_rules.md - 正向、失败路径、边界、PDA、Anchor errorCode
 */
import * as anchor from "@coral-xyz/anchor";
import { expect } from "chai";
import { PublicKey } from "@solana/web3.js";
import type { TestEnv } from "./helpers";

const DEFAULT_REVIEW_PERIOD_SECS = 259200; // 3 天
const APPLICATION_ID = 1;
const APPLICATION_ID_2 = 2;
const LAMPORTS_APPLY = 100 * 1e6; // 0.1 SOL

export function registerSponsorTests(env: TestEnv): void {
  const {
    program,
    provider,
    authority,
    other,
    configPda,
    treasuryPda,
    sponsorApplicationPda,
  } = env;

  describe("initialize_sponsor_config", () => {
    it("happy path: 初始化配置与金库，审核期限默认 3 天", async () => {
      const [configAddr] = configPda();
      const [treasuryAddr] = treasuryPda();

      await program.methods
        .initializeSponsorConfig(
          authority.publicKey, // admin_wallet 为主办方绑定钱包
          new anchor.BN(DEFAULT_REVIEW_PERIOD_SECS)
        )
        .accounts({
          authority: authority.publicKey,
          config: configAddr,
          treasury: treasuryAddr,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([authority])
        .rpc();

      const config = await program.account.sponsorConfig.fetch(configAddr);
      expect(config.authority.equals(authority.publicKey)).to.be.true;
      expect(config.adminWallet.equals(authority.publicKey)).to.be.true;
      expect(config.reviewPeriodSecs.toNumber()).to.equal(DEFAULT_REVIEW_PERIOD_SECS);
      expect(config.treasuryBump).to.be.a("number");
      expect(config.bump).to.be.a("number");
    });

    it("fail: 重复初始化 config（config PDA 已存在）", async () => {
      const [configAddr] = configPda();
      const [treasuryAddr] = treasuryPda();
      try {
        await program.methods
          .initializeSponsorConfig(
            authority.publicKey,
            new anchor.BN(DEFAULT_REVIEW_PERIOD_SECS)
          )
          .accounts({
            authority: authority.publicKey,
            config: configAddr,
            treasury: treasuryAddr,
            systemProgram: anchor.web3.SystemProgram.programId,
          })
          .signers([authority])
          .rpc();
        expect.fail("should have thrown");
      } catch (e: unknown) {
        const err = e as { message?: string; error?: { errorCode?: { code?: number } } };
        const msg = (err.message ?? "").toLowerCase();
        const code = err.error?.errorCode?.code ?? err.error?.errorCode;
        const isDuplicateInit =
          msg.includes("already in use") ||
          msg.includes("account already initialized") ||
          msg.includes("custom program error") ||
          code === 3011 ||
          code === 3009;
        expect(isDuplicateInit, `expected duplicate init error, got: ${err.message}`).to.be.true;
      }
    });
  });

  describe("sponsor_apply", () => {
    it("happy path: 长期赞助商发起申请，金额存入金库", async () => {
      const [configAddr] = configPda();
      const [treasuryAddr] = treasuryPda();
      const [appAddr] = sponsorApplicationPda(APPLICATION_ID);

      const sponsorBalBefore = await provider.connection.getBalance(other.publicKey);
      const treasuryBalBefore = await provider.connection.getBalance(treasuryAddr);

      await program.methods
        .sponsorApply(new anchor.BN(APPLICATION_ID), new anchor.BN(LAMPORTS_APPLY))
        .accounts({
          sponsor: other.publicKey,
          config: configAddr,
          treasury: treasuryAddr,
          application: appAddr,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([other])
        .rpc();

      const sponsorBalAfter = await provider.connection.getBalance(other.publicKey);
      const treasuryBalAfter = await provider.connection.getBalance(treasuryAddr);
      expect(sponsorBalBefore - sponsorBalAfter).to.be.at.least(LAMPORTS_APPLY);
      expect(treasuryBalAfter - treasuryBalBefore).to.equal(LAMPORTS_APPLY);

      const app = await program.account.sponsorApplication.fetch(appAddr);
      expect(app.sponsor.equals(other.publicKey)).to.be.true;
      expect(app.amountLamports.toNumber()).to.equal(LAMPORTS_APPLY);
      expect(app.status.pending !== undefined).to.be.true;
      expect(app.appliedAt.toNumber()).to.be.greaterThan(0);
      expect(app.bump).to.be.a("number");
    });

    it("fail: amount 为 0 时拒绝", async () => {
      const [configAddr] = configPda();
      const [treasuryAddr] = treasuryPda();
      const [appAddr] = sponsorApplicationPda(999);
      try {
        await program.methods
          .sponsorApply(new anchor.BN(999), new anchor.BN(0))
          .accounts({
            sponsor: other.publicKey,
            config: configAddr,
            treasury: treasuryAddr,
            application: appAddr,
            systemProgram: anchor.web3.SystemProgram.programId,
          })
          .signers([other])
          .rpc();
        expect.fail("should have thrown");
      } catch (e: unknown) {
        const err = e as {
          message?: string;
          error?: { errorMessage?: string; errorCode?: { code?: number } };
        };
        const msg = ((err.message ?? "") + (err.error?.errorMessage ?? "")).toLowerCase();
        const isZeroAmount =
          msg.includes("zeroamount") ||
          msg.includes("zero amount") ||
          msg.includes("greater than zero");
        expect(isZeroAmount, `expected ZeroAmount error, got: ${err.message}`).to.be.true;
      }
    });

    it("边界: application_id 使用 u64 大数可正常创建", async () => {
      const bigId = new anchor.BN("18446744073709551615");
      const [configAddr] = configPda();
      const [treasuryAddr] = treasuryPda();
      const [appAddr] = sponsorApplicationPda(bigId);
      const smallAmount = 1e6;

      await program.methods
        .sponsorApply(bigId, new anchor.BN(smallAmount))
        .accounts({
          sponsor: other.publicKey,
          config: configAddr,
          treasury: treasuryAddr,
          application: appAddr,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([other])
        .rpc();

      const app = await program.account.sponsorApplication.fetch(appAddr);
      expect(app.amountLamports.toNumber()).to.equal(smallAmount);
      expect(app.status.pending !== undefined).to.be.true;
    });
  });

  describe("approve_sponsor", () => {
    before(async () => {
      const [configAddr] = configPda();
      const [treasuryAddr] = treasuryPda();
      const [appAddr] = sponsorApplicationPda(APPLICATION_ID_2);
      await program.methods
        .sponsorApply(new anchor.BN(APPLICATION_ID_2), new anchor.BN(50 * 1e6))
        .accounts({
          sponsor: other.publicKey,
          config: configAddr,
          treasury: treasuryAddr,
          application: appAddr,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([other])
        .rpc();
    });

    it("happy path: 审核通过，金额转入主办方钱包", async () => {
      const [configAddr] = configPda();
      const [treasuryAddr] = treasuryPda();
      const [appAddr] = sponsorApplicationPda(APPLICATION_ID);

      const adminBalBefore = await provider.connection.getBalance(authority.publicKey);
      const treasuryBalBefore = await provider.connection.getBalance(treasuryAddr);

      await program.methods
        .approveSponsor(new anchor.BN(APPLICATION_ID))
        .accounts({
          authority: authority.publicKey,
          config: configAddr,
          treasury: treasuryAddr,
          application: appAddr,
          adminWallet: authority.publicKey,
          sponsorWallet: other.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([authority])
        .rpc();

      const adminBalAfter = await provider.connection.getBalance(authority.publicKey);
      const treasuryBalAfter = await provider.connection.getBalance(treasuryAddr);
      expect(adminBalAfter).to.equal(adminBalBefore + LAMPORTS_APPLY);
      expect(treasuryBalAfter).to.equal(treasuryBalBefore - LAMPORTS_APPLY);

      const app = await program.account.sponsorApplication.fetch(appAddr);
      expect(app.status.approved !== undefined).to.be.true;
    });

    it("fail: 非 config authority 不能审核通过", async () => {
      const [configAddr] = configPda();
      const [treasuryAddr] = treasuryPda();
      const [appAddr] = sponsorApplicationPda(APPLICATION_ID_2);

      const stranger = anchor.web3.Keypair.generate();
      const sig = await provider.connection.requestAirdrop(
        stranger.publicKey,
        anchor.web3.LAMPORTS_PER_SOL
      );
      await provider.connection.confirmTransaction(sig);

      try {
        await program.methods
          .approveSponsor(new anchor.BN(APPLICATION_ID_2))
          .accounts({
            authority: stranger.publicKey,
            config: configAddr,
            treasury: treasuryAddr,
            application: appAddr,
            adminWallet: authority.publicKey,
            sponsorWallet: other.publicKey,
            systemProgram: anchor.web3.SystemProgram.programId,
          })
          .signers([stranger])
          .rpc();
        expect.fail("should have thrown");
      } catch (e: unknown) {
        const err = e as { message?: string; error?: { errorMessage?: string } };
        expect(
          err.message?.includes("NotConfigAuthority") ||
            err.message?.includes("constraint") ||
            err.error?.errorMessage?.toLowerCase().includes("authority")
        ).to.be.true;
      }
    });

    it("fail: 已审核通过的申请不能再次审核通过", async () => {
      const [configAddr] = configPda();
      const [treasuryAddr] = treasuryPda();
      const [appAddr] = sponsorApplicationPda(APPLICATION_ID);

      try {
        await program.methods
          .approveSponsor(new anchor.BN(APPLICATION_ID))
          .accounts({
            authority: authority.publicKey,
            config: configAddr,
            treasury: treasuryAddr,
            application: appAddr,
            adminWallet: authority.publicKey,
            sponsorWallet: other.publicKey,
            systemProgram: anchor.web3.SystemProgram.programId,
          })
          .signers([authority])
          .rpc();
        expect.fail("should have thrown");
      } catch (e: unknown) {
        const err = e as {
          message?: string;
          error?: { errorMessage?: string; errorCode?: number };
          logs?: string[];
        };
        const msg = ((err.message ?? "") + (err.error?.errorMessage ?? "")).toLowerCase();
        const logsMatch = (err.logs ?? []).some(
          (l) => typeof l === "string" && l.includes("ApplicationNotPending")
        );
        const isExpected =
          msg.includes("applicationnotpending") ||
          msg.includes("pending") ||
          msg.includes("simulation failed") ||
          logsMatch;
        expect(isExpected, `expected ApplicationNotPending or simulation failure, got: ${err.message}`).to.be.true;
      }
    });
  });

  describe("reject_sponsor", () => {
    const APPLICATION_ID_REJECT = 3;
    before(async () => {
      const [configAddr] = configPda();
      const [treasuryAddr] = treasuryPda();
      const [appAddr] = sponsorApplicationPda(APPLICATION_ID_REJECT);
      await program.methods
        .sponsorApply(new anchor.BN(APPLICATION_ID_REJECT), new anchor.BN(30 * 1e6))
        .accounts({
          sponsor: other.publicKey,
          config: configAddr,
          treasury: treasuryAddr,
          application: appAddr,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([other])
        .rpc();
    });

    it("fail: 非 config authority 不能拒绝", async () => {
      const [treasuryAddr] = treasuryPda();
      const [appAddr] = sponsorApplicationPda(APPLICATION_ID_REJECT);
      const stranger = anchor.web3.Keypair.generate();
      const sig = await provider.connection.requestAirdrop(
        stranger.publicKey,
        anchor.web3.LAMPORTS_PER_SOL
      );
      await provider.connection.confirmTransaction(sig);

      try {
        await program.methods
          .rejectSponsor(new anchor.BN(APPLICATION_ID_REJECT))
          .accounts({
            authority: stranger.publicKey,
            config: configPda()[0],
            treasury: treasuryAddr,
            application: appAddr,
            adminWallet: authority.publicKey,
            sponsorWallet: other.publicKey,
            systemProgram: anchor.web3.SystemProgram.programId,
          })
          .signers([stranger])
          .rpc();
        expect.fail("should have thrown");
      } catch (e: unknown) {
        const err = e as { message?: string };
        expect(
          err.message?.includes("NotConfigAuthority") ||
            err.message?.includes("constraint")
        ).to.be.true;
      }
    });

    it("happy path: 审核失败，金额原路返回赞助商", async () => {
      const [configAddr] = configPda();
      const [treasuryAddr] = treasuryPda();
      const [appAddr] = sponsorApplicationPda(APPLICATION_ID_REJECT);
      const amount = 30 * 1e6;

      const sponsorBalBefore = await provider.connection.getBalance(other.publicKey);
      const treasuryBalBefore = await provider.connection.getBalance(treasuryAddr);

      await program.methods
        .rejectSponsor(new anchor.BN(APPLICATION_ID_REJECT))
        .accounts({
          authority: authority.publicKey,
          config: configAddr,
          treasury: treasuryAddr,
          application: appAddr,
          adminWallet: authority.publicKey,
          sponsorWallet: other.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([authority])
        .rpc();

      const sponsorBalAfter = await provider.connection.getBalance(other.publicKey);
      const treasuryBalAfter = await provider.connection.getBalance(treasuryAddr);
      expect(sponsorBalAfter).to.equal(sponsorBalBefore + amount);
      expect(treasuryBalAfter).to.equal(treasuryBalBefore - amount);

      const app = await program.account.sponsorApplication.fetch(appAddr);
      expect(app.status.rejected !== undefined).to.be.true;
    });

    it("fail: 已拒绝的申请不能再次拒绝", async () => {
      const [configAddr] = configPda();
      const [treasuryAddr] = treasuryPda();
      const [appAddr] = sponsorApplicationPda(APPLICATION_ID_REJECT);

      try {
        await program.methods
          .rejectSponsor(new anchor.BN(APPLICATION_ID_REJECT))
          .accounts({
            authority: authority.publicKey,
            config: configAddr,
            treasury: treasuryAddr,
            application: appAddr,
            adminWallet: authority.publicKey,
            sponsorWallet: other.publicKey,
            systemProgram: anchor.web3.SystemProgram.programId,
          })
          .signers([authority])
          .rpc();
        expect.fail("should have thrown");
      } catch (e: unknown) {
        const err = e as {
          message?: string;
          error?: { errorMessage?: string };
          logs?: string[];
        };
        const msg = ((err.message ?? "") + (err.error?.errorMessage ?? "")).toLowerCase();
        const logsMatch = (err.logs ?? []).some(
          (l) => typeof l === "string" && l.includes("ApplicationNotPending")
        );
        const isExpected =
          msg.includes("applicationnotpending") ||
          msg.includes("pending") ||
          msg.includes("simulation failed") ||
          logsMatch;
        expect(isExpected, `expected ApplicationNotPending or simulation failure, got: ${err.message}`).to.be.true;
      }
    });
  });
}
