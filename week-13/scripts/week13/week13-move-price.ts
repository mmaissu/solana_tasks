// Week 13 (rebalance test): the trader wallet moves the pool price to TARGET (TKB per 1 TKA)
// with a series of swaps. Big chunks far from the target, small chunks close to it.
//   target above current price -> sell TKB (TKA gets more expensive)
//   target below current price -> sell TKA
// Run with KEYPAIR=<trader keypair>.
import { swapInternal, getPdaExBitmapAccount, TickArrayBitmapExtensionLayout } from '@raydium-io/raydium-sdk-v2'
import BN from 'bn.js'
import Decimal from 'decimal.js'
import { PublicKey } from '@solana/web3.js'
import { getAssociatedTokenAddressSync } from '@solana/spl-token'
import { connection, owner, initSdk, txVersion } from '../config'

const POOL_ID = '5Bpew1UyKwP9YcZNxS4XhouCc5inW4ooF7MeCRYSZwZp'
const TOKEN_A = new PublicKey('58yZV9EGzxW1b7xBhMKC7VAMq5599VCdhMQ351eqmGyR') // TKA = pool mintB
const TOKEN_B = new PublicKey('trXbiGdDwxDCpKotLVBns8ueu1aagEwjb17YFT3XN3e') // TKB = pool mintA
const TARGET = new Decimal(process.env.TARGET ?? '109.5')
const BIG_CHUNK_TKB = new Decimal(process.env.BIG_CHUNK_TKB ?? '100')
const SMALL_CHUNK_TKB = new Decimal(process.env.SMALL_CHUNK_TKB ?? '10')
const MAX_SWAPS = 40
const SLIPPAGE_BPS = 200

const ui = (x: BN) => new Decimal(x.toString()).div(1e6).toString()
const bal = async (mint: PublicKey) => {
  try {
    return new BN((await connection.getTokenAccountBalance(getAssociatedTokenAddressSync(mint, owner.publicKey))).value.amount)
  } catch {
    return new BN(0)
  }
}

const main = async () => {
  const raydium = await initSdk()
  const price = async () => {
    const p = new Decimal((await raydium.clmm.getRpcClmmPoolInfo({ poolId: POOL_ID })).currentPrice.toString())
    return new Decimal(1).div(p) // TKB per 1 TKA
  }

  const swapOnce = async (zeroForOne: boolean, amountIn: BN) => {
    const { poolInfo, rpcData, configInfo, tickArrays } = await raydium.clmm.getSwapPoolInfo(POOL_ID, zeroForOne)
    const programId = new PublicKey(poolInfo.programId)
    const poolIdPub = new PublicKey(poolInfo.id)
    const bitmap = getPdaExBitmapAccount(programId, poolIdPub).publicKey
    const bitmapRes = await connection.getAccountInfo(bitmap)
    const sim = swapInternal({
      programId,
      poolId: poolIdPub,
      poolInfo: rpcData,
      tickArrays,
      configInfo,
      tickarrayBitmapExtension: TickArrayBitmapExtensionLayout.decode(bitmapRes!.data),
      amountSpecified: amountIn,
      sqrtPriceLimitX64: new BN(0),
      zeroForOne,
      isBaseInput: true,
      blockTimestamp: Math.floor(Date.now() / 1000),
      includeExtraTickArrays: true,
    })
    const expected = new BN(sim.amountCalculated.toString())
    const { execute } = await raydium.clmm.swap({
      poolInfo,
      inputMint: zeroForOne ? poolInfo.mintA.address : poolInfo.mintB.address,
      amountIn,
      amountOutMin: expected.muln(10000 - SLIPPAGE_BPS).divn(10000),
      observationId: rpcData.observationId,
      ownerInfo: { useSOLBalance: true },
      remainingAccounts: sim.accounts,
      txVersion,
      computeBudgetConfig: { units: 600000, microLamports: 10000 },
    })
    const { txId } = await execute({ sendAndConfirm: true })
    return txId
  }

  let p = await price()
  const up = TARGET.gt(p)
  console.log(`trader ${owner.publicKey.toBase58()}`)
  console.log(`price ${p.toFixed(4)} -> target ${TARGET.toFixed(4)} TKB per 1 TKA (${up ? 'sell TKB' : 'sell TKA'})`)
  console.log('trader before: TKA', ui(await bal(TOKEN_A)), '| TKB', ui(await bal(TOKEN_B)))

  for (let i = 1; i <= MAX_SWAPS; i++) {
    if (up ? p.gte(TARGET) : p.lte(TARGET)) break
    const far = p.sub(TARGET).abs().div(TARGET).gt(0.03)
    const chunkTkb = far ? BIG_CHUNK_TKB : SMALL_CHUNK_TKB
    // amount in raw units of the input token
    const amountIn = up
      ? new BN(chunkTkb.mul(1e6).floor().toFixed(0)) // TKB
      : new BN(chunkTkb.div(p).mul(1e6).floor().toFixed(0)) // TKA worth chunkTkb
    const tx = await swapOnce(up, amountIn)
    p = await price()
    console.log(`[${i}] sold ${ui(amountIn)} ${up ? 'TKB' : 'TKA'} | price ${p.toFixed(4)} | https://explorer.solana.com/tx/${tx}?cluster=devnet`)
  }

  console.log('final price: 1 TKA =', p.toFixed(4), 'TKB')
  console.log('trader after: TKA', ui(await bal(TOKEN_A)), '| TKB', ui(await bal(TOKEN_B)))
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
