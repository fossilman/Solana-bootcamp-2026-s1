/**
 * 测试公共：program、provider、PDA 推导、常量
 */
import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Hackathon } from "../target/types/hackathon";
import { PublicKey } from "@solana/web3.js";

const provider = anchor.AnchorProvider.env();
anchor.setProvider(provider);

export const program = anchor.workspace.hackathon as Program<Hackathon>;
export { provider };

export const TITLE = "Test Activity";
export const DESCRIPTION_HASH = Buffer.alloc(32, 1);

export function activityPda(
  programId: PublicKey,
  auth: PublicKey,
  id: number | anchor.BN | string
): [PublicKey, number] {
  const idBn = typeof id === "number" ? new anchor.BN(id) : new anchor.BN(id.toString());
  const leBytes = idBn.toArrayLike(Buffer, "le", 8);
  return PublicKey.findProgramAddressSync(
    [Buffer.from("activity"), auth.toBuffer(), leBytes],
    programId
  );
}

export function checkInsPda(programId: PublicKey, activity: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("check_ins"), activity.toBuffer()],
    programId
  );
}

export function voteRecordPda(
  programId: PublicKey,
  activity: PublicKey,
  voter: PublicKey
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("vote"), activity.toBuffer(), voter.toBuffer()],
    programId
  );
}

export function voteTallyPda(programId: PublicKey, activity: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("vote_tally"), activity.toBuffer()],
    programId
  );
}

export function configPda(programId: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("config")],
    programId
  );
}

export function treasuryPda(programId: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("treasury")],
    programId
  );
}

export function sponsorApplicationPda(
  programId: PublicKey,
  applicationId: number | anchor.BN | string
): [PublicKey, number] {
  const idBn =
    typeof applicationId === "number"
      ? new anchor.BN(applicationId)
      : new anchor.BN(applicationId.toString());
  const leBytes = idBn.toArrayLike(Buffer, "le", 8);
  return PublicKey.findProgramAddressSync(
    [Buffer.from("sponsor_application"), leBytes],
    programId
  );
}

export type TestEnv = {
  program: Program<Hackathon>;
  provider: anchor.AnchorProvider;
  authority: anchor.web3.Keypair;
  other: anchor.web3.Keypair;
  activityPda: (auth: PublicKey, id: number | anchor.BN | string) => [PublicKey, number];
  checkInsPda: (activity: PublicKey) => [PublicKey, number];
  voteRecordPda: (activity: PublicKey, voter: PublicKey) => [PublicKey, number];
  voteTallyPda: (activity: PublicKey) => [PublicKey, number];
  configPda: () => [PublicKey, number];
  treasuryPda: () => [PublicKey, number];
  sponsorApplicationPda: (applicationId: number | anchor.BN | string) => [PublicKey, number];
  TITLE: string;
  DESCRIPTION_HASH: Buffer;
};

export function createTestEnv(
  authority: anchor.web3.Keypair,
  other: anchor.web3.Keypair
): TestEnv {
  return {
    program,
    provider,
    authority,
    other,
    activityPda: (auth, id) => activityPda(program.programId, auth, id),
    checkInsPda: (activity) => checkInsPda(program.programId, activity),
    voteRecordPda: (activity, voter) => voteRecordPda(program.programId, activity, voter),
    voteTallyPda: (activity) => voteTallyPda(program.programId, activity),
    configPda: () => configPda(program.programId),
    treasuryPda: () => treasuryPda(program.programId),
    sponsorApplicationPda: (applicationId) =>
      sponsorApplicationPda(program.programId, applicationId),
    TITLE,
    DESCRIPTION_HASH,
  };
}
