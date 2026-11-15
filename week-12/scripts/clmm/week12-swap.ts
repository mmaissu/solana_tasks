import * as anchor from '@coral-xyz/anchor'
import { ComputeBudgetProgram, PublicKey } from '@solana/web3.js'
import { TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID } from '@solana/spl-token'
import { swapInternal, getPdaExBitmapAccount, TickArrayBitmapExtensionLayout } from '@raydium-io/raydium-sdk-v2'
import BN from 'bn.js'
import Decimal from 'decimal.js'
import fs from 'node:fs'
import path from 'node:path'
import { connection, owner, initSdk } from '../config'

const POOL_ID = '5Bpew1UyKwP9YcZNxS4XhouCc5inW4ooF7MeCRYSZwZp'
const TOKEN_A = new PublicKey('58yZV9EGzxW1b7xBhMKC7VAMq5599VCdhMQ351eqmGyR') // vault holds this
const TOKEN_B = new PublicKey('trXbiGdDwxDCpKotLVBns8ueu1aagEwjb17YFT3XN3e')
const AMOUNT_IN = new BN(1_000_000) // 1 TKA (the pool is thin)
const MEMO = new PublicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr')

const idl = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), 'src/simple_vault.idl.json'), 'utf8'))
const provider = new anchor.AnchorProvider(connection, new anchor.Wallet(owner), { commitment: 'confirmed' })
const program = new anchor.Program(idl, provider) as any

const pda = (seeds: Buffer[]) => PublicKey.findProgramAddressSync(seeds, program.programId)[0]
const vaultState = pda([Buffer.from('vault'), TOKEN_A.toBuffer()])
const vaultInput = pda([Buffer.from('vault_tokens'), TOKEN_A.toBuffer()])
const vaultOutput = pda([Buffer.from('vault_second'), vaultState.toBuffer(), TOKEN_B.toBuffer()])
const bal = async (k: PublicKey) => (await connection.getTokenAccountBalance(k)).value.uiAmountString

const main = async () => {
  const raydium = await initSdk()
  // the vault sells TKA; TKA is mintB of the pool (tokens are sorted by address) -> zeroForOne = false
  const zeroForOne = false
  const { poolInfo, rpcData, configInfo, tickArrays } = await raydium.clmm.getSwapPoolInfo(POOL_ID, zeroForOne)
  if (rpcData.mintB.toString() !== TOKEN_A.toString()) throw new Error('unexpected pool token order: ' + rpcData.mintB.toString())

  const programId = new PublicKey(poolInfo.programId)
  const poolIdPub = new PublicKey(poolInfo.id)
  const bitmapExt = getPdaExBitmapAccount(programId, poolIdPub).publicKey
  const bitmapRes = await connection.getAccountInfo(bitmapExt)

  const sim = swapInternal({
    programId,
    poolId: poolIdPub,
    poolInfo: rpcData,
    tickArrays,
    configInfo,
    tickarrayBitmapExtension: TickArrayBitmapExtensionLayout.decode(bitmapRes!.data),
    amountSpecified: AMOUNT_IN,
    sqrtPriceLimitX64: new BN(0),
    zeroForOne,
    isBaseInput: true,
    blockTimestamp: Math.floor(Date.now() / 1000),
    includeExtraTickArrays: true,
  })
  const expectedOut = new BN(sim.amountCalculated.toString())
  console.log('clmm program:', programId.toBase58())
  console.log('expected output (raw TKB):', expectedOut.toString())

  const remaining = [bitmapExt, ...sim.accounts].map((pubkey) => ({ pubkey, isSigner: false, isWritable: true }))

  const poolPrice = async () => new Decimal((await raydium.clmm.getRpcClmmPoolInfo({ poolId: POOL_ID })).currentPrice.toString())
  const show = async (label: string) => {
    const p = await poolPrice()
    console.log(`--- ${label} ---`)
    console.log('pool price (mintB per mintA):', p.toString(), '| 1 TKA =', new Decimal(1).div(p).toFixed(4), 'TKB')
    console.log('vault TKA:', await bal(vaultInput), '| vault TKB:', await bal(vaultOutput))
  }

  const sendSwap = async (label: string, minOut: BN) => {
    const ix = await program.methods
      .swap(AMOUNT_IN, minOut, new BN(0))
      .accountsPartial({
        admin: owner.publicKey,
        vaultState,
        vaultInputAccount: vaultInput,
        vaultOutputAccount: vaultOutput,
        ammConfig: new PublicKey(poolInfo.config.id),
        poolState: poolIdPub,
        inputVault: rpcData.vaultB,
        outputVault: rpcData.vaultA,
        observationState: rpcData.observationId,
        inputVaultMint: rpcData.mintB,
        outputVaultMint: rpcData.mintA,
        clmmProgram: programId,
        tokenProgram: TOKEN_PROGRAM_ID,
        tokenProgram2022: TOKEN_2022_PROGRAM_ID,
        memoProgram: MEMO,
      })
      .remainingAccounts(remaining)
      .instruction()
    const tx = new anchor.web3.Transaction().add(ComputeBudgetProgram.setComputeUnitLimit({ units: 400000 }), ix)
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed')
    tx.recentBlockhash = blockhash
    tx.feePayer = owner.publicKey
    tx.sign(owner)
    // skipPreflight: let even a failing swap land on chain, so it has an Explorer link
    const sig = await connection.sendRawTransaction(tx.serialize(), { skipPreflight: true })
    console.log(`[${label}] min_out=${minOut.toString()} tx: https://explorer.solana.com/tx/${sig}?cluster=devnet`)
    let status: any = null
    for (let i = 0; i < 30 && !status?.confirmationStatus; i++) {
      status = (await connection.getSignatureStatuses([sig], { searchTransactionHistory: true })).value[0]
      if (!status?.confirmationStatus) await new Promise((r) => setTimeout(r, 2000))
    }
    console.log(`[${label}] result:`, status?.err ? 'FAILED ' + JSON.stringify(status.err) : 'SUCCESS')
    for (let i = 0; i < 5; i++) {
      const t = await connection.getTransaction(sig, { commitment: 'confirmed', maxSupportedTransactionVersion: 0 })
      if (t) {
        t.meta?.logMessages?.filter((l) => /Error|slippage|little|failed|Program log/i.test(l)).forEach((l) => console.log('   log:', l))
        break
      }
      await new Promise((r) => setTimeout(r, 2000))
    }
  }

  await show('BEFORE')
  await sendSwap('REJECTED (min_out is 2x expected)', expectedOut.muln(2))
  await sendSwap('SUCCESS (min_out is 1% below expected)', expectedOut.muln(99).divn(100))
  await show('AFTER')
  process.exit()
}

main().catch((e) => { console.error(e); process.exit(1) })
