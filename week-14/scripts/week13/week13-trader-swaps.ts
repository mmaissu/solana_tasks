// Week 13: a separate "trader" wallet swaps in the pool so that positions earn fees.
// Each round: sell AMOUNT_TKA TKA -> TKB, then sell the received TKB back -> TKA,
// so the price returns near the start and stays inside the vault range.
// Run with KEYPAIR=<trader keypair>. Based on the official demo src/clmm/swap.ts.
import { swapInternal, getPdaExBitmapAccount, TickArrayBitmapExtensionLayout } from '@raydium-io/raydium-sdk-v2'
import BN from 'bn.js'
import Decimal from 'decimal.js'
import { PublicKey } from '@solana/web3.js'
import { getAssociatedTokenAddressSync } from '@solana/spl-token'
import { connection, owner, initSdk, txVersion } from '../config'

const POOL_ID = '5Bpew1UyKwP9YcZNxS4XhouCc5inW4ooF7MeCRYSZwZp'
const TOKEN_A = new PublicKey('58yZV9EGzxW1b7xBhMKC7VAMq5599VCdhMQ351eqmGyR') // TKA = pool mintB
const TOKEN_B = new PublicKey('trXbiGdDwxDCpKotLVBns8ueu1aagEwjb17YFT3XN3e') // TKB = pool mintA
const ROUNDS = Number(process.env.ROUNDS ?? '3')
const AMOUNT_TKA = new BN(Math.round(Number(process.env.AMOUNT_TKA ?? '1') * 1e6))
const SLIPPAGE_BPS = 100 // 1%

const ui = (x: BN) => new Decimal(x.toString()).div(1e6).toString()
const bal = async (mint: PublicKey) => {
  try {
    const ata = getAssociatedTokenAddressSync(mint, owner.publicKey)
    return new BN((await connection.getTokenAccountBalance(ata)).value.amount)
  } catch {
    return new BN(0)
  }
}

const main = async () => {
  const raydium = await initSdk()
  console.log('trader:', owner.publicKey.toBase58())

  const price = async () => {
    const p = new Decimal((await raydium.clmm.getRpcClmmPoolInfo({ poolId: POOL_ID })).currentPrice.toString())
    return new Decimal(1).div(p).toFixed(4) // TKB per 1 TKA
  }

  // zeroForOne = true: input mintA (TKB); false: input mintB (TKA)
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
    const minOut = expected.muln(10000 - SLIPPAGE_BPS).divn(10000)
    const inputMint = zeroForOne ? poolInfo.mintA.address : poolInfo.mintB.address

    const { execute } = await raydium.clmm.swap({
      poolInfo,
      inputMint,
      amountIn,
      amountOutMin: minOut,
      observationId: rpcData.observationId,
      ownerInfo: { useSOLBalance: true },
      remainingAccounts: sim.accounts,
      txVersion,
      computeBudgetConfig: { units: 600000, microLamports: 10000 },
    })
    const { txId } = await execute({ sendAndConfirm: true })
    return { txId, expected }
  }

  console.log('start price: 1 TKA =', await price(), 'TKB')
  console.log('trader before: TKA', ui(await bal(TOKEN_A)), '| TKB', ui(await bal(TOKEN_B)))

  for (let r = 1; r <= ROUNDS; r++) {
    const tkbBefore = await bal(TOKEN_B)
    const s1 = await swapOnce(false, AMOUNT_TKA)
    const got = (await bal(TOKEN_B)).sub(tkbBefore)
    console.log(`[round ${r}] sell ${ui(AMOUNT_TKA)} TKA -> ${ui(got)} TKB | price ${await price()} | https://explorer.solana.com/tx/${s1.txId}?cluster=devnet`)

    const tkaBefore = await bal(TOKEN_A)
    const s2 = await swapOnce(true, got)
    const back = (await bal(TOKEN_A)).sub(tkaBefore)
    console.log(`[round ${r}] sell ${ui(got)} TKB -> ${ui(back)} TKA | price ${await price()} | https://explorer.solana.com/tx/${s2.txId}?cluster=devnet`)
  }

  console.log('end price: 1 TKA =', await price(), 'TKB')
  console.log('trader after: TKA', ui(await bal(TOKEN_A)), '| TKB', ui(await bal(TOKEN_B)))
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
