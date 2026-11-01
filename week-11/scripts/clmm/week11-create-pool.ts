import { DEVNET_PROGRAM_ID } from '@raydium-io/raydium-sdk-v2'
import { PublicKey } from '@solana/web3.js'
import { TOKEN_PROGRAM_ID } from '@solana/spl-token'
import Decimal from 'decimal.js'
import { initSdk, txVersion } from '../config'

const TOKEN_A = '58yZV9EGzxW1b7xBhMKC7VAMq5599VCdhMQ351eqmGyR'
const TOKEN_B = 'trXbiGdDwxDCpKotLVBns8ueu1aagEwjb17YFT3XN3e'
const INITIAL_PRICE = 100 // 1 TOKEN_A = 100 TOKEN_B

const tokenInfo = (address: string, symbol: string) =>
  ({
    chainId: 103,
    address,
    programId: TOKEN_PROGRAM_ID.toBase58(),
    logoURI: '',
    symbol,
    name: symbol,
    decimals: 6,
    tags: [],
    extensions: {},
  }) as any

const main = async () => {
  const raydium = await initSdk()
  const clmmConfigs = await raydium.api.getClmmConfigs()
  // fee tier 0.25% (tickSpacing 60): "best for most pairs"
  const cfg = clmmConfigs.find((c: any) => c.tradeFeeRate === 2500) ?? clmmConfigs[0]
  console.log('fee tier:', { id: cfg.id, tradeFeeRate: cfg.tradeFeeRate, tickSpacing: cfg.tickSpacing })

  const { execute, extInfo } = await raydium.clmm.createPool({
    programId: DEVNET_PROGRAM_ID.CLMM_PROGRAM_ID,
    mint1: tokenInfo(TOKEN_A, 'TKA'),
    mint2: tokenInfo(TOKEN_B, 'TKB'),
    ammConfig: { ...cfg, id: new PublicKey(cfg.id), fundOwner: '', description: '' },
    initialPrice: new Decimal(INITIAL_PRICE),
    txVersion,
  })

  const { txId } = await execute({ sendAndConfirm: true })
  console.log('pool created, tx:', 'https://explorer.solana.com/tx/' + txId + '?cluster=devnet')
  const addr: any = (extInfo as any).address
  console.log('POOL ID:', addr?.id ?? '(not found: open the transaction in Explorer)')
  process.exit()
}

main()
