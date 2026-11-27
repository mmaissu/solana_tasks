// Raydium CLMM helpers for the admin page (same math as scripts/week12, week13)
import {
  DEV_API_URLS,
  PoolUtils,
  Raydium,
  TickArrayBitmapExtensionLayout,
  TickUtil,
  getPdaExBitmapAccount,
  getPdaPersonalPositionAddress,
  getPdaProtocolPositionAddress,
  getPdaTickArrayAddress,
  swapInternal,
} from '@raydium-io/raydium-sdk-v2'
import Decimal from 'decimal.js'
import { Connection, PublicKey } from '@solana/web3.js'
import { TOKEN_2022_PROGRAM_ID } from '@solana/spl-token'
import { BN } from '@coral-xyz/anchor'
import { CLMM_PROGRAM, POOL_ID, TKA_MINT, TKB_MINT, VAULT_SECOND, VAULT_STATE, VAULT_TOKENS } from './vault'

// Pool order: token0 = mintA = TKB, token1 = mintB = TKA. Pool price = TKA per 1 TKB.
const D = Decimal.clone({ precision: 40 })

let cached: { conn: Connection; sdk: Raydium } | null = null
export const loadSdk = async (connection: Connection) => {
  if (cached && cached.conn === connection) return cached.sdk
  const sdk = await Raydium.load({
    connection,
    cluster: 'devnet',
    disableFeatureCheck: true,
    disableLoadToken: true,
    blockhashCommitment: 'confirmed',
    urlConfigs: {
      ...DEV_API_URLS,
      BASE_HOST: 'https://api-v3-devnet.raydium.io',
      OWNER_BASE_HOST: 'https://owner-v1-devnet.raydium.io',
      SWAP_HOST: 'https://transaction-v1-devnet.raydium.io',
      CPMM_LOCK: 'https://dynamic-ipfs-devnet.raydium.io/lock/cpmm/position',
    },
  })
  cached = { conn: connection, sdk }
  return sdk
}

export const loadPool = async (connection: Connection) => {
  const sdk = await loadSdk(connection)
  const { poolInfo, poolKeys } = await sdk.clmm.getPoolInfoFromRpc(POOL_ID.toBase58())
  if (poolInfo.mintA.address !== TKB_MINT.toBase58() || poolInfo.mintB.address !== TKA_MINT.toBase58())
    throw new Error('Неожиданный порядок токенов в пуле')
  return { sdk, poolInfo, poolKeys, tkbPerTka: new D(1).div(poolInfo.price) }
}

// TKB per 1 TKA at a tick (both tokens have 6 decimals)
export const tickToTkbPerTka = (tick: number) => new D(1).div(new D('1.0001').pow(tick))

export type VaultPosition = {
  nftMint: PublicKey
  nftAccount: PublicKey
  personalPosition: PublicKey
  protocolPosition: PublicKey
  tickLower: number
  tickUpper: number
  tickArrayLower: PublicKey
  tickArrayUpper: PublicKey
  liquidity: BN
  low: Decimal // TKB per TKA, lower bound
  high: Decimal // TKB per TKA, upper bound
}

// Raydium PersonalPositionState: 8 discriminator, 1 bump, 32 nft_mint, 32 pool_id,
// i32 tick_lower, i32 tick_upper, u128 liquidity, ...
const decodePosition = (data: Buffer) => ({
  nftMint: new PublicKey(data.subarray(9, 41)),
  poolId: new PublicKey(data.subarray(41, 73)),
  tickLower: data.readInt32LE(73),
  tickUpper: data.readInt32LE(77),
  liquidity: new BN(data.subarray(81, 97), 'le'),
})

// Find position NFTs (Token-2022, amount 1) owned by the vault PDA
export const findVaultPositions = async (connection: Connection): Promise<VaultPosition[]> => {
  const res = await connection.getParsedTokenAccountsByOwner(VAULT_STATE, { programId: TOKEN_2022_PROGRAM_ID })
  const out: VaultPosition[] = []
  for (const { pubkey, account } of res.value) {
    const info = account.data.parsed.info
    if (info.tokenAmount.amount !== '1' || info.tokenAmount.decimals !== 0) continue
    const nftMint = new PublicKey(info.mint)
    const personalPosition = getPdaPersonalPositionAddress(CLMM_PROGRAM, nftMint).publicKey
    const acc = await connection.getAccountInfo(personalPosition)
    if (!acc) continue
    const p = decodePosition(acc.data)
    if (!p.nftMint.equals(nftMint) || !p.poolId.equals(POOL_ID)) continue
    const span = 60 * 60 // tick array = 60 ticks * tickSpacing 60
    out.push({
      nftMint,
      nftAccount: pubkey,
      personalPosition,
      protocolPosition: getPdaProtocolPositionAddress(CLMM_PROGRAM, POOL_ID, p.tickLower, p.tickUpper).publicKey,
      tickLower: p.tickLower,
      tickUpper: p.tickUpper,
      tickArrayLower: getPdaTickArrayAddress(CLMM_PROGRAM, POOL_ID, Math.floor(p.tickLower / span) * span).publicKey,
      tickArrayUpper: getPdaTickArrayAddress(CLMM_PROGRAM, POOL_ID, Math.floor(p.tickUpper / span) * span).publicKey,
      liquidity: p.liquidity,
      low: tickToTkbPerTka(p.tickUpper),
      high: tickToTkbPerTka(p.tickLower),
    })
  }
  return out
}

// Expected amounts for the whole liquidity at the current price, minimums = -1%
export const closeMins = (pos: VaultPosition, tkbPerTka: Decimal) => {
  const L = new D(pos.liquidity.toString())
  const sqrtA = new D('1.0001').pow(pos.tickLower).sqrt()
  const sqrtB = new D('1.0001').pow(pos.tickUpper).sqrt()
  const sqrtP = D.min(D.max(new D(1).div(tkbPerTka).sqrt(), sqrtA), sqrtB)
  const exp0 = L.mul(sqrtB.sub(sqrtP)).div(sqrtP.mul(sqrtB)).floor() // TKB
  const exp1 = L.mul(sqrtP.sub(sqrtA)).floor() // TKA
  return {
    expTkb: new BN(exp0.toFixed(0)),
    expTka: new BN(exp1.toFixed(0)),
    min0: new BN(exp0.mul(0.99).floor().toFixed(0)),
    min1: new BN(exp1.mul(0.99).floor().toFixed(0)),
  }
}

export const manageAccounts = (pos: VaultPosition, poolKeys: { vault: { A: string; B: string } }) => ({
  vaultState: VAULT_STATE,
  vaultTokenAccount: VAULT_TOKENS,
  secondMint: TKB_MINT,
  vaultSecondAccount: VAULT_SECOND,
  poolState: POOL_ID,
  protocolPosition: pos.protocolPosition,
  positionNftMint: pos.nftMint,
  positionNftAccount: pos.nftAccount,
  personalPosition: pos.personalPosition,
  tokenVault0: new PublicKey(poolKeys.vault.A),
  tokenVault1: new PublicKey(poolKeys.vault.B),
  tickArrayLower: pos.tickArrayLower,
  tickArrayUpper: pos.tickArrayUpper,
  vault0Mint: TKB_MINT,
  vault1Mint: TKA_MINT,
  clmmProgram: CLMM_PROGRAM,
})

export type OpenPlan = Awaited<ReturnType<typeof planOpen>>

// Range = current price +-pct %, base amount = baseTkb (raw TKB), TKA computed by the SDK
export const planOpen = async (connection: Connection, pct: number, baseTkb: BN) => {
  const { sdk, poolInfo, poolKeys, tkbPerTka } = await loadPool(connection)
  const low = tkbPerTka.mul(1 - pct / 100)
  const high = tkbPerTka.mul(1 + pct / 100)
  const dA = poolInfo.mintA.decimals
  const dB = poolInfo.mintB.decimals
  const spacing = poolInfo.config.tickSpacing
  const tickLower = TickUtil.toTickIndex(TickUtil.priceToTick(new Decimal(1).div(high.toString()), dA, dB), spacing)
  const tickUpper = TickUtil.toTickIndex(TickUtil.priceToTick(new Decimal(1).div(low.toString()), dA, dB), spacing)
  const span = spacing * 60
  const taLower = Math.floor(tickLower / span) * span
  const taUpper = Math.floor(tickUpper / span) * span

  const calc = await PoolUtils.getLiquidityAmountOutFromAmountIn({
    poolInfo,
    slippage: 0,
    inputA: true, // base = mintA = TKB
    tickUpper,
    tickLower,
    amount: baseTkb,
    add: true,
    amountHasFee: true,
    epochInfo: await sdk.fetchEpochInfo(),
  })
  const needTkb = new BN(calc.amountA.amount.toString())
  const needTka = new BN(calc.amountB.amount.toString())
  return {
    price: tkbPerTka,
    low: tickToTkbPerTka(tickUpper),
    high: tickToTkbPerTka(tickLower),
    tickLower,
    tickUpper,
    taLower,
    taUpper,
    liquidity: new BN(calc.liquidity.toString()),
    needTkb,
    needTka,
    max0: needTkb.muln(101).divn(100).addn(1), // TKB limit
    max1: needTka.muln(101).divn(100).addn(1), // TKA limit
    poolKeys,
  }
}

export const openAccounts = (plan: OpenPlan, nftMint: PublicKey) => ({
  vaultState: VAULT_STATE,
  vaultTokenAccount: VAULT_TOKENS,
  secondMint: TKB_MINT,
  vaultSecondAccount: VAULT_SECOND,
  poolState: POOL_ID,
  protocolPosition: getPdaProtocolPositionAddress(CLMM_PROGRAM, POOL_ID, plan.tickLower, plan.tickUpper).publicKey,
  positionNftMint: nftMint,
  positionNftAccount: PublicKey.findProgramAddressSync(
    [VAULT_STATE.toBuffer(), TOKEN_2022_PROGRAM_ID.toBuffer(), nftMint.toBuffer()],
    new PublicKey('ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL'),
  )[0],
  personalPosition: getPdaPersonalPositionAddress(CLMM_PROGRAM, nftMint).publicKey,
  tickArrayLower: getPdaTickArrayAddress(CLMM_PROGRAM, POOL_ID, plan.taLower).publicKey,
  tickArrayUpper: getPdaTickArrayAddress(CLMM_PROGRAM, POOL_ID, plan.taUpper).publicKey,
  tokenVault0: new PublicKey(plan.poolKeys.vault.A),
  tokenVault1: new PublicKey(plan.poolKeys.vault.B),
  vault0Mint: TKB_MINT,
  vault1Mint: TKA_MINT,
  clmmProgram: CLMM_PROGRAM,
})

export type SwapDirection = 'TKA_TO_TKB' | 'TKB_TO_TKA'
export type SwapPlan = Awaited<ReturnType<typeof planSwap>>

// Simulate a vault swap; accounts and remaining accounts for the program's `swap`
export const planSwap = async (connection: Connection, direction: SwapDirection, amountIn: BN) => {
  const sdk = await loadSdk(connection)
  const zeroForOne = direction === 'TKB_TO_TKA' // input = mintA = TKB
  const { poolInfo, rpcData, configInfo, tickArrays } = await sdk.clmm.getSwapPoolInfo(POOL_ID.toBase58(), zeroForOne)
  const bitmapExt = getPdaExBitmapAccount(CLMM_PROGRAM, POOL_ID).publicKey
  const bitmapRes = await connection.getAccountInfo(bitmapExt)
  const sim = swapInternal({
    programId: CLMM_PROGRAM,
    poolId: POOL_ID,
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
  const expectedOut = new BN(sim.amountCalculated.toString())
  return {
    direction,
    amountIn,
    expectedOut,
    minOut: expectedOut.muln(99).divn(100), // slippage 1%
    remaining: [bitmapExt, ...sim.accounts].map((pubkey: PublicKey) => ({ pubkey, isSigner: false, isWritable: true })),
    accounts: {
      vaultState: VAULT_STATE,
      vaultInputAccount: zeroForOne ? VAULT_SECOND : VAULT_TOKENS,
      vaultOutputAccount: zeroForOne ? VAULT_TOKENS : VAULT_SECOND,
      ammConfig: new PublicKey(poolInfo.config.id),
      poolState: POOL_ID,
      inputVault: zeroForOne ? rpcData.vaultA : rpcData.vaultB,
      outputVault: zeroForOne ? rpcData.vaultB : rpcData.vaultA,
      observationState: rpcData.observationId,
      inputVaultMint: zeroForOne ? rpcData.mintA : rpcData.mintB,
      outputVaultMint: zeroForOne ? rpcData.mintB : rpcData.mintA,
      clmmProgram: CLMM_PROGRAM,
    },
  }
}
