/**
 * 一次性初始化链上赞助商配置与金库（initialize_sponsor_config）。
 * 在首次使用 sponsor_apply 前必须在当前集群（localnet/devnet/mainnet）上执行一次。
 *
 * 务必在 contract/solana/hackathon 目录下执行（先 yarn install）：
 *   cd contract/solana/hackathon
 *   yarn install
 *   yarn init-sponsor-config
 *
 * 或指定环境变量：
 *   ANCHOR_PROVIDER_URL=https://api.devnet.solana.com \
 *   ANCHOR_WALLET=~/.config/solana/id.json \
 *   SOLANA_SPONSOR_ADMIN_WALLET=<主办方收款地址，可选，默认用签名钱包> \
 *   REVIEW_PERIOD_SECS=259200 \
 *   yarn init-sponsor-config
 */

import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Hackathon } from "../target/types/hackathon";
import { PublicKey } from "@solana/web3.js";
import * as fs from "fs";
import * as path from "path";

const PROGRAM_ID = new PublicKey("7pgYzGEw9byBrFkPmRVtvqE3GDdUwpxXAANc6CEBXhk9");
const DEFAULT_REVIEW_PERIOD_SECS = 259200; // 3 天

function configPda(programId: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("config")],
    programId
  );
}

function treasuryPda(programId: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("treasury")],
    programId
  );
}

function loadKeypair(p: string): anchor.web3.Keypair {
  const expanded = p.startsWith("~")
    ? path.join(process.env.HOME || "", p.slice(1))
    : path.resolve(p);
  const secret = JSON.parse(fs.readFileSync(expanded, "utf-8"));
  return anchor.web3.Keypair.fromSecretKey(Uint8Array.from(secret));
}

async function main() {
  const rpcUrl =
    process.env.ANCHOR_PROVIDER_URL ||
    process.env.SOLANA_RPC_URL ||
    "http://127.0.0.1:8899";
  const walletPath =
    process.env.ANCHOR_WALLET || path.join(process.env.HOME || "", "/sponsor_admin_wallet.json");
  const adminWalletStr = process.env.SOLANA_SPONSOR_ADMIN_WALLET;
  const reviewPeriodSecs = process.env.REVIEW_PERIOD_SECS
    ? parseInt(process.env.REVIEW_PERIOD_SECS, 10)
    : DEFAULT_REVIEW_PERIOD_SECS;

  const connection = new anchor.web3.Connection(rpcUrl);
  const wallet = loadKeypair(walletPath);
  const provider = new anchor.AnchorProvider(
    connection,
    new anchor.Wallet(wallet),
    { commitment: "confirmed" }
  );
  anchor.setProvider(provider);

  const idlPath = path.join(__dirname, "../target/idl/hackathon.json");
  const idl = JSON.parse(fs.readFileSync(idlPath, "utf-8"));
  const program = new Program(idl as anchor.Idl, provider) as Program<Hackathon>;

  const [configAddr] = configPda(PROGRAM_ID);
  const [treasuryAddr] = treasuryPda(PROGRAM_ID);
  const adminWallet = adminWalletStr
    ? new PublicKey(adminWalletStr)
    : wallet.publicKey;

  console.log("RPC:", rpcUrl);
  console.log("Authority (signer):", wallet.publicKey.toBase58());
  console.log("Admin wallet (收款地址):", adminWallet.toBase58());
  console.log("Config PDA:", configAddr.toBase58());
  console.log("Treasury PDA:", treasuryAddr.toBase58());
  console.log("Review period (secs):", reviewPeriodSecs);

  const sig = await program.methods
    .initializeSponsorConfig(adminWallet, new anchor.BN(reviewPeriodSecs))
    .accounts({
      authority: wallet.publicKey,
      config: configAddr,
      treasury: treasuryAddr,
      systemProgram: anchor.web3.SystemProgram.programId,
    } as any)
    .signers([wallet])
    .rpc();

  console.log("Tx:", sig);
  console.log("Sponsor config 已初始化，可以正常使用 sponsor_apply。");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
