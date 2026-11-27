// Addresses and helpers of the Liquidity Vault on devnet
import { Buffer } from 'buffer'
import { PublicKey } from '@solana/web3.js'
import { BN } from '@coral-xyz/anchor'

export const RPC_URL = 'https://api.devnet.solana.com'
export const PROGRAM_ID = new PublicKey('25exdZUmhe6Xah5wxHrXf1w851F3Da36tb4W2E6fG6L4')
export const TKA_MINT = new PublicKey('58yZV9EGzxW1b7xBhMKC7VAMq5599VCdhMQ351eqmGyR') // vault token
export const TKB_MINT = new PublicKey('trXbiGdDwxDCpKotLVBns8ueu1aagEwjb17YFT3XN3e') // second token
export const POOL_ID = new PublicKey('5Bpew1UyKwP9YcZNxS4XhouCc5inW4ooF7MeCRYSZwZp') // Raydium CLMM TKB/TKA
export const DECIMALS = 6
export const CLMM_PROGRAM = new PublicKey('DRayAUgENGQBKVaX8owNhgzkEDyoHTGVEGHVJT1E9pfH') // Raydium CLMM devnet
export const MEMO_PROGRAM = new PublicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr')

const pda = (seeds: Buffer[]) => PublicKey.findProgramAddressSync(seeds, PROGRAM_ID)[0]
export const VAULT_STATE = pda([Buffer.from('vault'), TKA_MINT.toBuffer()])
export const VAULT_TOKENS = pda([Buffer.from('vault_tokens'), TKA_MINT.toBuffer()])
export const SHARE_MINT = pda([Buffer.from('share_mint'), TKA_MINT.toBuffer()])
export const VAULT_SECOND = pda([Buffer.from('vault_second'), VAULT_STATE.toBuffer(), TKB_MINT.toBuffer()])
export const userCardPda = (user: PublicKey) =>
  pda([Buffer.from('user_card'), VAULT_STATE.toBuffer(), user.toBuffer()])

export const explorerTx = (sig: string) => `https://explorer.solana.com/tx/${sig}?cluster=devnet`
export const explorerAddr = (a: PublicKey | string) =>
  `https://explorer.solana.com/address/${a.toString()}?cluster=devnet`
export const short = (a: PublicKey | string) => {
  const s = a.toString()
  return `${s.slice(0, 4)}…${s.slice(-4)}`
}

// raw units (BN / bigint / string) -> "123.45"
export const toUi = (raw: BN | bigint | string | number, decimals = DECIMALS): string => {
  const s = raw.toString().padStart(decimals + 1, '0')
  const int = s.slice(0, -decimals)
  const frac = s.slice(-decimals).replace(/0+$/, '')
  return frac ? `${int}.${frac}` : int
}

// "12.5" -> BN raw units; null if the input is not a valid positive number
export const toRaw = (ui: string, decimals = DECIMALS): BN | null => {
  const v = ui.trim().replace(',', '.')
  if (!new RegExp(`^\\d+(\\.\\d{0,${decimals}})?$`).test(v)) return null
  const [i, f = ''] = v.split('.')
  const raw = new BN(i + f.padEnd(decimals, '0'))
  return raw.isZero() ? null : raw
}
