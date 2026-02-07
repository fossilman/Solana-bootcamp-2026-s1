/**
 * Hackathon 测试入口：按场景聚合 activity / check_in / vote 测试
 */
import * as anchor from "@coral-xyz/anchor";
import { expect } from "chai";
import { program, provider, createTestEnv } from "./helpers";
import { registerActivityTests } from "./activity.test";
import { registerCheckInTests } from "./check_in.test";
import { registerSponsorTests } from "./sponsor.test";
import { registerVoteTests } from "./vote.test";

const authority = anchor.web3.Keypair.generate();
const other = anchor.web3.Keypair.generate();
const env = createTestEnv(authority, other);

before(async () => {
  const airdrop = await provider.connection.requestAirdrop(
    authority.publicKey,
    2 * anchor.web3.LAMPORTS_PER_SOL
  );
  await provider.connection.confirmTransaction(airdrop);
  const airdropOther = await provider.connection.requestAirdrop(
    other.publicKey,
    anchor.web3.LAMPORTS_PER_SOL
  );
  await provider.connection.confirmTransaction(airdropOther);
});

describe("hackathon", () => {
  it("initialize (happy path)", async () => {
    const tx = await program.methods.initialize().rpc();
    expect(tx).to.be.a("string");
  });

  describe("活动与报名 (activity)", () => {
    registerActivityTests(env);
  });

  describe("签到信息上链 (check_in)", () => {
    registerCheckInTests(env);
  });

  describe("投票与汇总 (vote)", () => {
    registerVoteTests(env);
  });

  describe("赞助商资金管理 (sponsor)", () => {
    registerSponsorTests(env);
  });
});
