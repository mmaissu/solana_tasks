import { ApiV3PoolInfoConcentratedItem, TickUtil, LiquidityMathUtil, ClmmKeys } from '@raydium-io/raydium-sdk-v2'
import BN from 'bn.js'
import Decimal from 'decimal.js'
import { initSdk, txVersion } from '../config'

const POOL_ID = '5Bpew1UyKwP9YcZNxS4XhouCc5inW4ooF7MeCRYSZwZp'
const TOKEN_A = '58yZV9EGzxW1b7xBhMKC7VAMq5599VCdhMQ351eqmGyR'
// range in terms of "price of TOKEN_A in TOKEN_B"
const RANGE_LOW = 90
const RANGE_HIGH = 110
const INPUT_AMOUNT = 1000 // units of the pool's mintA

const main = async () => {
  const raydium = await initSdk()
    let poolInfo: ApiV3PoolInfoConcentratedItem | undefined
  for (let i = 0; i < 12; i++) {
    const arr = await raydium.api.fetchPoolById({ ids: POOL_ID })
    if (arr && arr[0]) {
      poolInfo = arr[0] as ApiV3PoolInfoConcentratedItem
      break
    }
    console.log('pool is not in the Raydium devnet API yet, retry in 10s...')
    await new Promise((r) => setTimeout(r, 10000))
  }
  if (!poolInfo) throw new Error('pool not found in the Raydium devnet API after 2 minutes')
  const poolKeys: ClmmKeys | undefined = undefined

  const aIsTokenA = poolInfo.mintA.address === TOKEN_A
  console.log('pool mintA:', poolInfo.mintA.address, '| mintB:', poolInfo.mintB.address)
  console.log('current pool price (mintB per mintA):', poolInfo.price)

  // convert the range to the pool direction if the pair is reversed
  const startPrice = aIsTokenA ? RANGE_LOW : 1 / RANGE_HIGH
  const endPrice = aIsTokenA ? RANGE_HIGH : 1 / RANGE_LOW

  const dA = poolInfo.mintA.decimals
  const dB = poolInfo.mintB.decimals
  const spacing = poolInfo.config.tickSpacing
  const lowerTick = TickUtil.toTickIndex(TickUtil.priceToTick(new Decimal(startPrice), dA, dB), spacing)
  const upperTick = TickUtil.toTickIndex(TickUtil.priceToTick(new Decimal(endPrice), dA, dB), spacing)

  const sqrtPriceCurrentX64 = TickUtil.priceToSqrtPriceX64(new Decimal(poolInfo.price), dA, dB)
  const sqrtPriceLowerX64 = TickUtil.getSqrtPriceAtTick(lowerTick)
  const sqrtPriceUpperX64 = TickUtil.getSqrtPriceAtTick(upperTick)

  console.log('Tick Lower', lowerTick, '| Price Lower', TickUtil.tickToPrice(lowerTick, dA, dB).toFixed(6))
  console.log('Tick Upper', upperTick, '| Price Upper', TickUtil.tickToPrice(upperTick, dA, dB).toFixed(6))

  const desiredAmount0 = new BN(INPUT_AMOUNT).mul(new BN(10).pow(new BN(dA)))
  const res = LiquidityMathUtil.getLiquidityAndAmountsFromAmount({
    sqrtPriceCurrentX64,
    sqrtPriceLowerX64,
    sqrtPriceUpperX64,
    amountInfo: { type: 'amountA', amount: desiredAmount0 },
  })
  const { amountA, amountB } = LiquidityMathUtil.getAmountsForLiquidity(
    sqrtPriceCurrentX64,
    sqrtPriceLowerX64,
    sqrtPriceUpperX64,
    res.liquidity,
    true,
  )
  const amount1Max = amountB.muln(10100).divn(10000) // 1% slippage
  console.log('will deposit about', amountA.toString(), 'of mintA and', amountB.toString(), 'of mintB (raw units)')

  const { execute, extInfo } = await raydium.clmm.openPositionFromBase({
    poolInfo,
    poolKeys,
    tickUpper: Math.max(lowerTick, upperTick),
    tickLower: Math.min(lowerTick, upperTick),
    base: 'MintA',
    ownerInfo: { useSOLBalance: true },
    liquidity: new BN(0),
    baseAmount: desiredAmount0,
    otherAmountMax: amount1Max,
    nft2022: true,
    txVersion,
    computeBudgetConfig: { units: 600000, microLamports: 100000 },
  })

  const { txId } = await execute({ sendAndConfirm: true })
  console.log('position opened, tx:', 'https://explorer.solana.com/tx/' + txId + '?cluster=devnet')
  console.log('POSITION NFT:', extInfo.nftMint.toBase58())
  process.exit()
}

main()
