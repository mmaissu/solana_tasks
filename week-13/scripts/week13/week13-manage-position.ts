// Week 13: manage the vault position (admin only).
//   ACTION=collect -> vault collects fees (decrease_liquidity_v2 with liquidity = 0)
//   ACTION=close   -> vault withdraws all liquidity with minimums (expected -1%) and burns the NFT
// Reads week13-position.json written by week13-open-position.ts.
// Results are appended to week13-results.json (for README).
import * as anchor from '@coral-xyz/anchor'
import { ComputeBudgetProgram, PublicKey, SystemProgram } from '@solana/web3.js'
import { TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID } from '@solana/spl-token'
import BN from 'bn.js'
import Decimal from 'decimal.js'
import fs from 'node:fs'
import path from 'node:path'
import { connection, owner, initSdk } from '../config'

Decimal.set({ precision: 40 })

const ACTION = process.env.ACTION ?? 'collect'
const TOKEN_A = new PublicKey('58yZV9EGzxW1b7xBhMKC7VAMq5599VCdhMQ351eqmGyR') // TKA: first vault token = pool mintB (token1)
const TOKEN_B = new PublicKey('trXbiGdDwxDCpKotLVBns8ueu1aagEwjb17YFT3XN3e') // TKB: second vault token = pool mintA (token0)
const MEMO = new PublicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr')
const SLIPPAGE = new Decimal('0.01')
const STATE_FILE = path.resolve(process.cwd(), 'week13-position.json')
const RESULTS_FILE = path.resolve(process.cwd(), 'week13-results.json')

const idl = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), 'src/simple_vault.idl.json'), 'utf8'))
const provider = new anchor.AnchorProvider(connection, new anchor.Wallet(owner), { commitment: 'confirmed' })
const program = new anchor.Program(idl, provider) as any

const pda = (seeds: Buffer[]) => PublicKey.findProgramAddressSync(seeds, program.programId)[0]
const vaultState = pda([Buffer.from('vault'), TOKEN_A.toBuffer()])
const vaultTka = pda([Buffer.from('vault_tokens'), TOKEN_A.toBuffer()])
const vaultTkb = pda([Buffer.from('vault_second'), vaultState.toBuffer(), TOKEN_B.toBuffer()])
const raw = async (k: PublicKey) => new BN((await connection.getTokenAccountBalance(k)).value.amount)
const ui = (x: BN | Decimal) => new Decimal(x.toString()).div(1e6).toString()

const programLogs = async (sig: string) => {
  for (let i = 0; i < 10; i++) {
    const t = await connection.getTransaction(sig, { commitment: 'confirmed', maxSupportedTransactionVersion: 0 })
    if (t) return (t.meta?.logMessages ?? []).filter((l) => /Fees collected|Position closed|Error/i.test(l))
    await new Promise((r) => setTimeout(r, 2000))
  }
  return []
}

const main = async () => {
  if (!['collect', 'close'].includes(ACTION)) throw new Error('ACTION must be collect or close')
  if (!fs.existsSync(STATE_FILE)) throw new Error(`${STATE_FILE} not found: open a position first`)
  const st = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'))

  const raydium = await initSdk()
  const { poolInfo, poolKeys } = await raydium.clmm.getPoolInfoFromRpc(st.pool)
  if (poolInfo.mintA.address !== TOKEN_B.toBase58() || poolInfo.mintB.address !== TOKEN_A.toBase58())
    throw new Error('unexpected pool token order')
  const programId = new PublicKey(poolInfo.programId)

  // current price: pool price = token1 per token0 = TKA per 1 TKB (both 6 decimals)
  const poolPrice = new Decimal((await raydium.clmm.getRpcClmmPoolInfo({ poolId: st.pool })).currentPrice.toString())
  const tkbPerTka = new Decimal(1).div(poolPrice)
  const inRange = tkbPerTka.gte(st.rangeTkbPerTka[0]) && tkbPerTka.lte(st.rangeTkbPerTka[1])
  console.log(`action: ${ACTION} | position NFT ${st.nftMint}`)
  console.log(`price: 1 TKA = ${tkbPerTka.toFixed(4)} TKB | range ${st.rangeTkbPerTka[0]}..${st.rangeTkbPerTka[1]} | ${inRange ? 'IN range' : 'OUT of range'}`)

  const tka0 = await raw(vaultTka)
  const tkb0 = await raw(vaultTkb)
  console.log('vault before: TKA', ui(tka0), '| TKB', ui(tkb0))

  const accounts = {
    admin: owner.publicKey,
    vaultState,
    vaultTokenAccount: vaultTka,
    secondMint: TOKEN_B,
    vaultSecondAccount: vaultTkb,
    poolState: new PublicKey(st.pool),
    protocolPosition: new PublicKey(st.protocolPosition),
    positionNftMint: new PublicKey(st.nftMint),
    positionNftAccount: new PublicKey(st.positionNftAccount),
    personalPosition: new PublicKey(st.personalPosition),
    tokenVault0: new PublicKey(poolKeys.vault.A),
    tokenVault1: new PublicKey(poolKeys.vault.B),
    tickArrayLower: new PublicKey(st.tickArrayLower),
    tickArrayUpper: new PublicKey(st.tickArrayUpper),
    vault0Mint: TOKEN_B,
    vault1Mint: TOKEN_A,
    clmmProgram: programId,
    tokenProgram: TOKEN_PROGRAM_ID,
    tokenProgram2022: TOKEN_2022_PROGRAM_ID,
    memoProgram: MEMO,
    systemProgram: SystemProgram.programId,
  }

  let builder: any
  let mins: { min0: string; min1: string } | undefined
  if (ACTION === 'collect') {
    builder = program.methods.collectFees()
  } else {
    // expected amounts for the whole liquidity at the current price (CLMM formulas):
    // token0 = L * (sqrtB - sqrtP) / (sqrtP * sqrtB), token1 = L * (sqrtP - sqrtA)
    const L = new Decimal(st.liquidity)
    const sqrtA = new Decimal('1.0001').pow(st.tickLower).sqrt()
    const sqrtB = new Decimal('1.0001').pow(st.tickUpper).sqrt()
    const sqrtP = Decimal.min(Decimal.max(poolPrice.sqrt(), sqrtA), sqrtB)
    const exp0 = L.mul(sqrtB.sub(sqrtP)).div(sqrtP.mul(sqrtB)) // TKB
    const exp1 = L.mul(sqrtP.sub(sqrtA)) // TKA
    const min0 = exp0.mul(new Decimal(1).sub(SLIPPAGE)).floor()
    const min1 = exp1.mul(new Decimal(1).sub(SLIPPAGE)).floor()
    mins = { min0: min0.toFixed(0), min1: min1.toFixed(0) }
    console.log('expected (without fees): TKB', ui(exp0.floor()), '| TKA', ui(exp1.floor()))
    console.log('minimums (-1%):          TKB', ui(min0), '| TKA', ui(min1))
    builder = program.methods.closeRaydiumPosition(new BN(mins.min0), new BN(mins.min1))
  }

  let sig: string
  try {
    sig = await builder
      .accountsPartial(accounts)
      .preInstructions([ComputeBudgetProgram.setComputeUnitLimit({ units: 400_000 })])
      .rpc({ commitment: 'confirmed' })
  } catch (e: any) {
    console.log(`${ACTION.toUpperCase()} FAILED:`, e.message ?? e)
    const logs = e.logs ?? e.transactionLogs ?? []
    logs.forEach((l: string) => console.log('   log:', l))
    process.exit(1)
  }

  const tka1 = await raw(vaultTka)
  const tkb1 = await raw(vaultTkb)
  const gotTka = tka1.sub(tka0)
  const gotTkb = tkb1.sub(tkb0)
  console.log(`${ACTION.toUpperCase()} OK tx: https://explorer.solana.com/tx/${sig}?cluster=devnet`)
  ;(await programLogs(sig)).forEach((l) => console.log('   log:', l))
  console.log('vault after:  TKA', ui(tka1), '| TKB', ui(tkb1))
  console.log(`received:     TKA ${ui(gotTka)} | TKB ${ui(gotTkb)}`)

  const results = fs.existsSync(RESULTS_FILE) ? JSON.parse(fs.readFileSync(RESULTS_FILE, 'utf8')) : []
  results.push({
    action: ACTION,
    time: new Date().toISOString(),
    nftMint: st.nftMint,
    range: st.rangeTkbPerTka,
    priceTkbPerTka: tkbPerTka.toFixed(4),
    receivedTka: ui(gotTka),
    receivedTkb: ui(gotTkb),
    mins,
    tx: sig,
  })
  fs.writeFileSync(RESULTS_FILE, JSON.stringify(results, null, 2))

  if (ACTION === 'close') {
    const archived = path.resolve(process.cwd(), `week13-position-closed-${st.nftMint.slice(0, 6)}.json`)
    fs.renameSync(STATE_FILE, archived)
    console.log('position file moved to', archived)
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
