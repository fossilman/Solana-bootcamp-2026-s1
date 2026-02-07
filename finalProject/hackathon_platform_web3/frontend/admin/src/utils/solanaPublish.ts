/**
 * 前端构建 publish_activity 交易并用 Phantom 签名，供活动发布使用。
 * 发布密钥由用户钱包授权，后端不配置 SOLANA_AUTHORITY_KEY。
 */
import {
  PublicKey,
  Transaction,
  TransactionInstruction,
  SystemProgram,
  Connection,
} from '@solana/web3.js'

// 与合约 target/idl/hackathon.json 中 publish_activity.discriminator 一致
const ANCHOR_DISCRIMINATOR_PUBLISH_ACTIVITY = new Uint8Array([
  20, 103, 95, 10, 205, 95, 194, 150,
])

// start_registration / start_check_in 仅 8 字节 discriminator，无 args（与 idl 一致）
const ANCHOR_DISCRIMINATOR_START_REGISTRATION = new Uint8Array([
  82, 180, 24, 158, 181, 152, 150, 176,
])
const ANCHOR_DISCRIMINATOR_START_CHECK_IN = new Uint8Array([
  103, 94, 164, 75, 177, 116, 94, 218,
])
const ANCHOR_DISCRIMINATOR_START_TEAM_FORMATION = new Uint8Array([
  236, 242, 132, 165, 119, 105, 105, 24,
])
const ANCHOR_DISCRIMINATOR_START_SUBMISSION = new Uint8Array([
  190, 59, 91, 67, 254, 135, 221, 182,
])
const ANCHOR_DISCRIMINATOR_START_VOTING = new Uint8Array([
  68, 29, 234, 70, 139, 251, 237, 179,
])
const ANCHOR_DISCRIMINATOR_START_RESULTS = new Uint8Array([
  181, 153, 118, 134, 245, 64, 50, 41,
])
// upload_check_ins / upload_vote_tally 指令 discriminator（sha256("global:upload_check_ins") 等前 8 字节）
const ANCHOR_DISCRIMINATOR_UPLOAD_CHECK_INS = new Uint8Array([229, 85, 118, 34, 116, 217, 94, 132])
const ANCHOR_DISCRIMINATOR_UPLOAD_VOTE_TALLY = new Uint8Array([137, 246, 218, 62, 167, 234, 252, 218])
// sponsor_apply：长期赞助商申请，金额转入金库（与 idl 一致）
const ANCHOR_DISCRIMINATOR_SPONSOR_APPLY = new Uint8Array([220, 249, 215, 239, 70, 238, 175, 200])
// approve_sponsor / reject_sponsor：主办方链上审核（与 idl 一致）
const ANCHOR_DISCRIMINATOR_APPROVE_SPONSOR = new Uint8Array([211, 168, 31, 70, 3, 140, 143, 222])
const ANCHOR_DISCRIMINATOR_REJECT_SPONSOR = new Uint8Array([61, 97, 242, 119, 75, 71, 123, 220])

export interface PreparePublishData {
  program_id: string
  rpc_url: string
  activity_id: number
  title: string
  description_hash_hex: string
}

function u64LeBytes(n: number): Uint8Array {
  const buf = new ArrayBuffer(8)
  new DataView(buf).setBigUint64(0, BigInt(n), true)
  return new Uint8Array(buf)
}

function encodePublishActivityInstruction(
  activityId: number,
  title: string,
  descriptionHashHex: string
): Uint8Array {
  const titleBytes = new TextEncoder().encode(title)
  const descHash = new Uint8Array(32)
  for (let i = 0; i < 32 && i * 2 < descriptionHashHex.length; i++) {
    descHash[i] = parseInt(descriptionHashHex.slice(i * 2, i * 2 + 2), 16)
  }
  const len = 8 + 8 + 4 + titleBytes.length + 32
  const data = new Uint8Array(len)
  let off = 0
  data.set(ANCHOR_DISCRIMINATOR_PUBLISH_ACTIVITY, off)
  off += 8
  data.set(u64LeBytes(activityId), off)
  off += 8
  new DataView(data.buffer).setUint32(off, titleBytes.length, true)
  off += 4
  data.set(titleBytes, off)
  off += titleBytes.length
  data.set(descHash, off)
  return data
}

/** 根据 authority 与 activity_id 推导链上 activity PDA */
export function deriveActivityPDA(
  authority: PublicKey,
  activityId: number,
  programId: PublicKey
): [PublicKey, number] {
  const seeds = [
    new TextEncoder().encode('activity'),
    authority.toBuffer(),
    u64LeBytes(activityId),
  ]
  return PublicKey.findProgramAddressSync(seeds, programId)
}

/** 根据 activity PDA 推导 check_ins PDA */
export function deriveCheckInsPDA(activityPDA: PublicKey, programId: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [new TextEncoder().encode('check_ins'), activityPDA.toBuffer()],
    programId
  )
}

/** 根据 activity PDA 推导 vote_tally PDA */
export function deriveVoteTallyPDA(activityPDA: PublicKey, programId: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [new TextEncoder().encode('vote_tally'), activityPDA.toBuffer()],
    programId
  )
}

const textEncoder = new TextEncoder()

/** 赞助商配置 PDA (seeds = [b"config"]) */
export function deriveSponsorConfigPDA(programId: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [textEncoder.encode('config')],
    programId
  )
}

/** 金库 PDA (seeds = [b"treasury"]) */
export function deriveTreasuryPDA(programId: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [textEncoder.encode('treasury')],
    programId
  )
}

/** 赞助商申请 PDA (seeds = [b"sponsor_application", application_id le u64]) */
export function deriveSponsorApplicationPDA(
  programId: PublicKey,
  applicationId: number
): [PublicKey, number] {
  const leBytes = new Uint8Array(8)
  new DataView(leBytes.buffer).setBigUint64(0, BigInt(applicationId), true)
  return PublicKey.findProgramAddressSync(
    [textEncoder.encode('sponsor_application'), leBytes],
    programId
  )
}

/** 赞助商申请 prepare 接口返回结构 */
export interface PrepareSponsorApplyData {
  program_id: string
  rpc_url: string
}

/**
 * 构建 sponsor_apply 未签名交易（赞助商将 amount_lamports 转入金库并创建链上申请记录，供 Phantom 签名）
 */
export function buildSponsorApplyTransaction(
  programId: PublicKey,
  applicationId: number,
  amountLamports: number,
  sponsorPublicKey: PublicKey,
  recentBlockhash: string
): Transaction {
  const [configPDA] = deriveSponsorConfigPDA(programId)
  const [treasuryPDA] = deriveTreasuryPDA(programId)
  const [applicationPDA] = deriveSponsorApplicationPDA(programId, applicationId)

  const data = new Uint8Array(8 + 8 + 8)
  data.set(ANCHOR_DISCRIMINATOR_SPONSOR_APPLY, 0)
  new DataView(data.buffer).setBigUint64(8, BigInt(applicationId), true)
  new DataView(data.buffer).setBigUint64(16, BigInt(amountLamports), true)

  const ix = new TransactionInstruction({
    programId,
    keys: [
      { pubkey: sponsorPublicKey, isSigner: true, isWritable: true },
      { pubkey: configPDA, isSigner: false, isWritable: false },
      { pubkey: treasuryPDA, isSigner: false, isWritable: true },
      { pubkey: applicationPDA, isSigner: false, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data,
  })

  const transaction = new Transaction().add(ix)
  transaction.recentBlockhash = recentBlockhash
  transaction.feePayer = sponsorPublicKey
  return transaction
}

/** SOL 转 lamports（1 SOL = 1e9 lamports） */
export const LAMPORTS_PER_SOL = 1e9
export function solToLamports(sol: number): number {
  return Math.floor(sol * LAMPORTS_PER_SOL)
}

/** 赞助商审核 prepare 接口返回结构（链上 approve_sponsor / reject_sponsor 用） */
export interface PrepareSponsorReviewData {
  program_id: string
  rpc_url: string
  admin_wallet: string
  sponsor_wallet: string
  application_id: number
}

/**
 * 构建 approve_sponsor 或 reject_sponsor 未签名交易（主办方钱包签名，审核通过转主办方 / 拒绝原路返回）
 */
function buildSponsorReviewTransaction(
  programId: PublicKey,
  applicationId: number,
  authority: PublicKey,
  adminWallet: PublicKey,
  sponsorWallet: PublicKey,
  recentBlockhash: string,
  approve: boolean
): Transaction {
  const [configPDA] = deriveSponsorConfigPDA(programId)
  const [treasuryPDA] = deriveTreasuryPDA(programId)
  const [applicationPDA] = deriveSponsorApplicationPDA(programId, applicationId)

  const discriminator = approve ? ANCHOR_DISCRIMINATOR_APPROVE_SPONSOR : ANCHOR_DISCRIMINATOR_REJECT_SPONSOR
  const data = new Uint8Array(8 + 8)
  data.set(discriminator, 0)
  new DataView(data.buffer).setBigUint64(8, BigInt(applicationId), true)

  const ix = new TransactionInstruction({
    programId,
    keys: [
      { pubkey: authority, isSigner: true, isWritable: false },
      { pubkey: configPDA, isSigner: false, isWritable: false },
      { pubkey: treasuryPDA, isSigner: false, isWritable: true },
      { pubkey: applicationPDA, isSigner: false, isWritable: true },
      { pubkey: adminWallet, isSigner: false, isWritable: true },
      { pubkey: sponsorWallet, isSigner: false, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data,
  })

  const transaction = new Transaction().add(ix)
  transaction.recentBlockhash = recentBlockhash
  transaction.feePayer = authority
  return transaction
}

export function buildApproveSponsorTransaction(
  prepare: PrepareSponsorReviewData,
  authority: PublicKey,
  recentBlockhash: string
): Transaction {
  const programId = new PublicKey(prepare.program_id)
  const adminWallet = new PublicKey(prepare.admin_wallet)
  const sponsorWallet = new PublicKey(prepare.sponsor_wallet)
  return buildSponsorReviewTransaction(
    programId,
    prepare.application_id,
    authority,
    adminWallet,
    sponsorWallet,
    recentBlockhash,
    true
  )
}

export function buildRejectSponsorTransaction(
  prepare: PrepareSponsorReviewData,
  authority: PublicKey,
  recentBlockhash: string
): Transaction {
  const programId = new PublicKey(prepare.program_id)
  const adminWallet = new PublicKey(prepare.admin_wallet)
  const sponsorWallet = new PublicKey(prepare.sponsor_wallet)
  return buildSponsorReviewTransaction(
    programId,
    prepare.application_id,
    authority,
    adminWallet,
    sponsorWallet,
    recentBlockhash,
    false
  )
}

/**
 * 构建未签名的 publish_activity 交易并返回（用于 Phantom 签名）
 * recentBlockhash 需从 RPC 获取后传入
 */
export function buildPublishActivityTransaction(
  prepare: PreparePublishData,
  authority: PublicKey,
  recentBlockhash: string
): { transaction: Transaction; activityPDA: PublicKey } {
  const programId = new PublicKey(prepare.program_id)
  const [activityPDA] = deriveActivityPDA(authority, prepare.activity_id, programId)
  const data = encodePublishActivityInstruction(
    prepare.activity_id,
    prepare.title,
    prepare.description_hash_hex
  )
  const keys = [
    { pubkey: authority, isSigner: true, isWritable: true },
    { pubkey: activityPDA, isSigner: false, isWritable: true },
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
  ]
  const ix = new TransactionInstruction({
    programId,
    keys,
    data: data,
  })
  const transaction = new Transaction().add(ix)
  transaction.recentBlockhash = recentBlockhash
  transaction.feePayer = authority
  return { transaction, activityPDA }
}

/**
 * 使用 Phantom 签名交易，返回 base64 序列化（供后端提交）
 */
export async function signTransactionWithPhantom(transaction: Transaction): Promise<string> {
  const phantom = (window as any).phantom?.solana
  if (!phantom || typeof phantom.signTransaction !== 'function') {
    throw new Error('请安装并连接 Phantom 钱包后再发布')
  }
  const signed = await phantom.signTransaction(transaction)
  const serialized = signed.serialize()
  const base64 = btoa(String.fromCharCode(...new Uint8Array(serialized)))
  return base64
}

/**
 * 获取最新 blockhash（用于设置 transaction 并签名）
 */
export async function getLatestBlockhash(rpcUrl: string): Promise<string> {
  const connection = new Connection(rpcUrl)
  const { value } = await connection.getLatestBlockhashAndContext('finalized')
  return value.blockhash
}

/** 切换阶段 prepare 接口返回（需链上更新时） */
export interface PrepareSwitchStageData {
  need_chain_update: boolean
  program_id?: string
  rpc_url?: string
  chain_activity_address?: string
  activity_id?: number
  chain_instruction?:
    | 'start_registration'
    | 'start_check_in'
    | 'start_team_formation'
    | 'start_submission'
    | 'start_voting'
    | 'start_results'
    | 'upload_check_ins'
    | 'upload_vote_tally'
  /** 签到->组队时：链上签到名单（Solana 地址） */
  attendee_pubkeys?: string[]
  /** 投票->公布结果时：作品 ID 列表 */
  candidate_ids?: number[]
  /** 投票->公布结果时：对应得票数 */
  vote_counts?: number[]
}

const SWITCH_STAGE_DISCRIMINATORS: Record<string, Uint8Array> = {
  start_registration: ANCHOR_DISCRIMINATOR_START_REGISTRATION,
  start_check_in: ANCHOR_DISCRIMINATOR_START_CHECK_IN,
  start_team_formation: ANCHOR_DISCRIMINATOR_START_TEAM_FORMATION,
  start_submission: ANCHOR_DISCRIMINATOR_START_SUBMISSION,
  start_voting: ANCHOR_DISCRIMINATOR_START_VOTING,
  start_results: ANCHOR_DISCRIMINATOR_START_RESULTS,
}

/**
 * 构建阶段切换指令的未签名交易（报名/签到/组队/上传代码/投票/公布结果，用于 Phantom 签名）
 */
export function buildSwitchStageTransaction(
  prepare: PrepareSwitchStageData,
  authority: PublicKey,
  recentBlockhash: string
): Transaction {
  if (!prepare.program_id || !prepare.chain_activity_address || !prepare.chain_instruction) {
    throw new Error('prepare 缺少 program_id / chain_activity_address / chain_instruction')
  }
  // 签到->组队、投票->公布结果 使用单独构建函数
  if (prepare.chain_instruction === 'upload_check_ins') {
    return buildUploadCheckInsTransaction(prepare, authority, recentBlockhash)
  }
  if (prepare.chain_instruction === 'upload_vote_tally') {
    return buildUploadVoteTallyTransaction(prepare, authority, recentBlockhash)
  }
  const data = SWITCH_STAGE_DISCRIMINATORS[prepare.chain_instruction]
  if (!data) {
    throw new Error(`不支持的 chain_instruction: ${prepare.chain_instruction}`)
  }
  const programId = new PublicKey(prepare.program_id)
  const activityPDA = new PublicKey(prepare.chain_activity_address)
  const keys = [
    { pubkey: authority, isSigner: true, isWritable: false },
    { pubkey: activityPDA, isSigner: false, isWritable: true },
  ]
  const ix = new TransactionInstruction({
    programId,
    keys,
    data: data instanceof Uint8Array ? data : new Uint8Array(data),
  })
  const transaction = new Transaction().add(ix)
  transaction.recentBlockhash = recentBlockhash
  transaction.feePayer = authority
  return transaction
}

/**
 * 构建 upload_check_ins 未签名交易（签到->组队时将签到名单上链）
 * 先插入 start_check_in 指令，确保链上处于 CheckIn 阶段再上传签到名单，避免 InvalidPhaseForCheckInUpload(6003)
 */
export function buildUploadCheckInsTransaction(
  prepare: PrepareSwitchStageData,
  authority: PublicKey,
  recentBlockhash: string
): Transaction {
  if (!prepare.program_id || !prepare.chain_activity_address || !Array.isArray(prepare.attendee_pubkeys)) {
    throw new Error('prepare 缺少 program_id / chain_activity_address / attendee_pubkeys')
  }
  const programId = new PublicKey(prepare.program_id)
  const activityPDA = new PublicKey(prepare.chain_activity_address)
  const [checkInsPDA] = deriveCheckInsPDA(activityPDA, programId)

  // 1) start_check_in：确保链上为 CheckIn 阶段（若当前为 Registration 则推进到 CheckIn），避免 6003
  const startCheckInIx = new TransactionInstruction({
    programId,
    keys: [
      { pubkey: authority, isSigner: true, isWritable: false },
      { pubkey: activityPDA, isSigner: false, isWritable: true },
    ],
    data: ANCHOR_DISCRIMINATOR_START_CHECK_IN,
  })

  // 2) upload_check_ins：上传签到名单并将阶段推进到 TeamFormation
  const pubkeys = prepare.attendee_pubkeys.map((addr) => new PublicKey(addr))
  const data = new Uint8Array(8 + 4 + 32 * pubkeys.length)
  data.set(ANCHOR_DISCRIMINATOR_UPLOAD_CHECK_INS, 0)
  new DataView(data.buffer).setUint32(8, pubkeys.length, true)
  pubkeys.forEach((pk, i) => data.set(pk.toBuffer(), 12 + i * 32))
  const uploadCheckInsIx = new TransactionInstruction({
    programId,
    keys: [
      { pubkey: authority, isSigner: true, isWritable: true },
      { pubkey: activityPDA, isSigner: false, isWritable: true },
      { pubkey: checkInsPDA, isSigner: false, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data,
  })

  const transaction = new Transaction().add(startCheckInIx, uploadCheckInsIx)
  transaction.recentBlockhash = recentBlockhash
  transaction.feePayer = authority
  return transaction
}

/**
 * 构建 upload_vote_tally 未签名交易（投票->公布结果时将投票汇总上链）
 * 先插入 start_voting 指令，确保链上处于 Voting 阶段再上传投票汇总，避免 InvalidPhaseForTally(6007)
 */
export function buildUploadVoteTallyTransaction(
  prepare: PrepareSwitchStageData,
  authority: PublicKey,
  recentBlockhash: string
): Transaction {
  if (
    !prepare.program_id ||
    !prepare.chain_activity_address ||
    !Array.isArray(prepare.candidate_ids) ||
    !Array.isArray(prepare.vote_counts) ||
    prepare.candidate_ids.length !== prepare.vote_counts.length
  ) {
    throw new Error('prepare 缺少 program_id / chain_activity_address / candidate_ids / vote_counts 或长度不一致')
  }
  const programId = new PublicKey(prepare.program_id)
  const activityPDA = new PublicKey(prepare.chain_activity_address)
  const [voteTallyPDA] = deriveVoteTallyPDA(activityPDA, programId)
  const n = prepare.candidate_ids.length

  // 1) start_voting：确保链上为 Voting 阶段（若当前为 Submission 等则推进到 Voting），避免 6007
  const startVotingIx = new TransactionInstruction({
    programId,
    keys: [
      { pubkey: authority, isSigner: true, isWritable: false },
      { pubkey: activityPDA, isSigner: false, isWritable: true },
    ],
    data: ANCHOR_DISCRIMINATOR_START_VOTING,
  })

  // 2) upload_vote_tally：上传投票汇总并将阶段推进到 Ended
  // 指令数据：discriminator(8) + Vec<u64> candidate_ids: len(4) + 8*n + Vec<u64> vote_counts: len(4) + 8*n
  const data = new Uint8Array(8 + 4 + 8 * n + 4 + 8 * n)
  let off = 0
  data.set(ANCHOR_DISCRIMINATOR_UPLOAD_VOTE_TALLY, off)
  off += 8
  new DataView(data.buffer).setUint32(off, n, true)
  off += 4
  for (let i = 0; i < n; i++) {
    new DataView(data.buffer).setBigUint64(off, BigInt(prepare.candidate_ids![i]), true)
    off += 8
  }
  new DataView(data.buffer).setUint32(off, n, true)
  off += 4
  for (let i = 0; i < n; i++) {
    new DataView(data.buffer).setBigUint64(off, BigInt(prepare.vote_counts![i]), true)
    off += 8
  }
  const uploadVoteTallyIx = new TransactionInstruction({
    programId,
    keys: [
      { pubkey: authority, isSigner: true, isWritable: true },
      { pubkey: activityPDA, isSigner: false, isWritable: true },
      { pubkey: voteTallyPDA, isSigner: false, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data,
  })
  const transaction = new Transaction().add(startVotingIx, uploadVoteTallyIx)
  transaction.recentBlockhash = recentBlockhash
  transaction.feePayer = authority
  return transaction
}
