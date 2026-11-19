// Week 13: the vault opens its own position in the Raydium CLMM pool (admin only).
// Range: current price +-RANGE_PCT % (default 10). TKB is the base amount (98% of vault TKB),
// the SDK computes the matching TKA. Limits amount_0_max / amount_1_max = expected +1%.
// Result is saved to week13-position.json (public keys only) for collect / close scripts.
import * as anchor from '@coral-xyz/anchor'
import { ComputeBudgetProgram, Keypair, PublicKey, SystemProgram, SYSVAR_RENT_PUBKEY } from '@solana/web3.js'
import {
  TOKEN_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync,
} from '@solana/spl-token'
import {
  PoolUtils,
  TickUtil,
  getPdaPersonalPositionAddress,
  getPdaProtocolPositionAddress,
  getPdaTickArrayAddress,
} from '@raydium-io/raydium-sdk-v2'
import BN from 'bn.js'
import Decimal from 'decimal.js'
import fs from 'node:fs'
import path from 'node:path'
import { connection, owner, initSdk } from '../config'

const POOL_ID = '5Bpew1UyKwP9YcZNxS4XhouCc5inW4ooF7MeCRYSZwZp'
const TOKEN_A = new PublicKey('58yZV9EGzxW1b7xBhMKC7VAMq5599VCdhMQ351eqmGyR') // TKA: first vault token = pool mintB
const TOKEN_B = new PublicKey('trXbiGdDwxDCpKotLVBns8ueu1aagEwjb17YFT3XN3e') // TKB: second vault token = pool mintA
const RANGE_PCT = Number(process.env.RANGE_PCT ?? '10')
const USE_TKB_PCT = 98
const STATE_FILE = path.resolve(process.cwd(), 'week13-position.json')

const idl = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), 'src/simple_vault.idl.json'), 'utf8'))
const provider = new anchor.AnchorProvider(connection, new anchor.Wallet(owner), { commitment: 'confirmed' })
const program = new anchor.Program(idl, provider) as any

const pda = (seeds: Buffer[]) => PublicKey.findProgramAddressSync(seeds, program.programId)[0]
const vaultState = pda([Buffer.from('vault'), TOKEN_A.toBuffer()])
const vaultTka = pda([Buffer.from('vault_tokens'), TOKEN_A.toBuffer()])
const vaultTkb = pda([Buffer.from('vault_second'), vaultState.toBuffer(), TOKEN_B.toBuffer()])
const raw = async (k: PublicKey) => new BN((await connection.getTokenAccountBalance(k)).value.amount)
const ui = (x: BN) => new Decimal(x.toString()).div(1e6).toString()

const main = async () => {
  if (fs.existsSync(STATE_FILE)) throw new Error(`${STATE_FILE} exists: close the current position first`)
  const raydium = await initSdk()
  const { poolInfo, poolKeys } = await raydium.clmm.getPoolInfoFromRpc(POOL_ID)
  if (poolInfo.mintA.address !== TOKEN_B.toBase58() || poolInfo.mintB.address !== TOKEN_A.toBase58())
    throw new Error('unexpected pool token order')

  const programId = new PublicKey(poolInfo.programId)
  const poolId = new PublicKey(poolInfo.id)
  const tickSpacing = poolInfo.config.tickSpacing

  // pool price = mintB per mintA = TKA per 1 TKB. We think in TKB per 1 TKA.
  const tkbPerTka = new Decimal(1).div(poolInfo.price)
  const lowTkbPerTka = tkbPerTka.mul(1 - RANGE_PCT / 100)
  const highTkbPerTka = tkbPerTka.mul(1 + RANGE_PCT / 100)
  // more TKB per TKA = lower pool price = lower tick (same math as week11-create-position.ts)
  const dA = poolInfo.mintA.decimals
  const dB = poolInfo.mintB.decimals
  const tickLower = TickUtil.toTickIndex(TickUtil.priceToTick(new Decimal(1).div(highTkbPerTka), dA, dB), tickSpacing)
  const tickUpper = TickUtil.toTickIndex(TickUtil.priceToTick(new Decimal(1).div(lowTkbPerTka), dA, dB), tickSpacing)
  // tick array = 60 ticks * tickSpacing, start index rounded down
  const arraySpan = tickSpacing * 60
  const taLower = Math.floor(tickLower / arraySpan) * arraySpan
  const taUpper = Math.floor(tickUpper / arraySpan) * arraySpan

  console.log('pool price: 1 TKA =', tkbPerTka.toFixed(4), 'TKB')
  console.log(`range +-${RANGE_PCT}%: ${lowTkbPerTka.toFixed(4)} .. ${highTkbPerTka.toFixed(4)} TKB per 1 TKA`)
  console.log(`ticks: ${tickLower} .. ${tickUpper} | tick arrays: ${taLower}, ${taUpper}`)

  const tka0 = await raw(vaultTka)
  const tkb0 = await raw(vaultTkb)
  console.log('vault before: TKA', ui(tka0), '| TKB', ui(tkb0))

  const baseTkb = tkb0.muln(USE_TKB_PCT).divn(100)
  const calc = await PoolUtils.getLiquidityAmountOutFromAmountIn({
    poolInfo,
    slippage: 0,
    inputA: true, // base = mintA = TKB
    tickUpper,
    tickLower,
    amount: baseTkb,
    add: true,
    amountHasFee: true,
    epochInfo: await raydium.fetchEpochInfo(),
  })
  const needTkb = new BN(calc.amountA.amount.toString())
  const needTka = new BN(calc.amountB.amount.toString())
  const max0 = needTkb.muln(101).divn(100).addn(1) // token0 = TKB
  const max1 = needTka.muln(101).divn(100).addn(1) // token1 = TKA
  console.log('liquidity:', calc.liquidity.toString())
  console.log('expected: TKB', ui(needTkb), '| TKA', ui(needTka))
  console.log('limits:   max0 (TKB)', ui(max0), '| max1 (TKA)', ui(max1))
  if (max0.gt(tkb0) || max1.gt(tka0)) throw new Error('vault balance is below the limits')
  if (process.env.DRY_RUN === '1') {
    console.log('DRY_RUN=1: nothing sent')
    return
  }

  const nftMint = Keypair.generate() // one-time signer, not saved
  const positionNftAccount = getAssociatedTokenAddressSync(nftMint.publicKey, vaultState, true, TOKEN_2022_PROGRAM_ID)
  const personalPosition = getPdaPersonalPositionAddress(programId, nftMint.publicKey).publicKey
  const protocolPosition = getPdaProtocolPositionAddress(programId, poolId, tickLower, tickUpper).publicKey
  const tickArrayLower = getPdaTickArrayAddress(programId, poolId, taLower).publicKey
  const tickArrayUpper = getPdaTickArrayAddress(programId, poolId, taUpper).publicKey

  let sig: string
  try {
    sig = await program.methods
      .openRaydiumPosition(tickLower, tickUpper, taLower, taUpper, new BN(calc.liquidity.toString()), max0, max1)
      .accountsPartial({
        admin: owner.publicKey,
        vaultState,
        vaultTokenAccount: vaultTka,
        secondMint: TOKEN_B,
        vaultSecondAccount: vaultTkb,
        poolState: poolId,
        protocolPosition,
        positionNftMint: nftMint.publicKey,
        positionNftAccount,
        personalPosition,
        tickArrayLower,
        tickArrayUpper,
        tokenVault0: new PublicKey(poolKeys.vault.A),
        tokenVault1: new PublicKey(poolKeys.vault.B),
        vault0Mint: TOKEN_B,
        vault1Mint: TOKEN_A,
        clmmProgram: programId,
        rent: SYSVAR_RENT_PUBKEY,
        systemProgram: SystemProgram.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
        tokenProgram2022: TOKEN_2022_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      })
      .preInstructions([ComputeBudgetProgram.setComputeUnitLimit({ units: 600_000 })])
      .signers([nftMint])
      .rpc({ commitment: 'confirmed' })
  } catch (e: any) {
    console.log('OPEN FAILED:', e.message ?? e)
    const logs = e.logs ?? e.transactionLogs ?? []
    logs.forEach((l: string) => console.log('   log:', l))
    process.exit(1)
  }

  const tka1 = await raw(vaultTka)
  const tkb1 = await raw(vaultTkb)
  console.log('OPEN OK tx:', `https://explorer.solana.com/tx/${sig}?cluster=devnet`)
  console.log('position NFT:', nftMint.publicKey.toBase58())
  console.log('vault after:  TKA', ui(tka1), '| TKB', ui(tkb1))
  console.log('deposited:    TKA', ui(tka0.sub(tka1)), '| TKB', ui(tkb0.sub(tkb1)))

  const state = {
    pool: poolId.toBase58(),
    nftMint: nftMint.publicKey.toBase58(),
    positionNftAccount: positionNftAccount.toBase58(),
    personalPosition: personalPosition.toBase58(),
    protocolPosition: protocolPosition.toBase58(),
    tickLower,
    tickUpper,
    tickArrayLower: tickArrayLower.toBase58(),
    tickArrayUpper: tickArrayUpper.toBase58(),
    rangeTkbPerTka: [lowTkbPerTka.toFixed(4), highTkbPerTka.toFixed(4)],
    priceAtOpen: tkbPerTka.toFixed(4),
    liquidity: calc.liquidity.toString(),
    depositedTka: ui(tka0.sub(tka1)),
    depositedTkb: ui(tkb0.sub(tkb1)),
    openTx: sig,
  }
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2))
  console.log('saved', STATE_FILE)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
