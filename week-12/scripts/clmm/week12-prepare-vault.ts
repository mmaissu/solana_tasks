import * as anchor from '@coral-xyz/anchor'
import { PublicKey, SystemProgram, SYSVAR_RENT_PUBKEY } from '@solana/web3.js'
import { TOKEN_PROGRAM_ID, getOrCreateAssociatedTokenAccount } from '@solana/spl-token'
import fs from 'node:fs'
import path from 'node:path'
import { connection, owner } from '../config'

const TOKEN_A = new PublicKey('58yZV9EGzxW1b7xBhMKC7VAMq5599VCdhMQ351eqmGyR') // vault ????????? ???? ?????
const TOKEN_B = new PublicKey('trXbiGdDwxDCpKotLVBns8ueu1aagEwjb17YFT3XN3e') // ?????? ????? ????
const DEPOSIT = new anchor.BN(1_000_000_000) // 1000 ??????? (6 ??????)

const idl = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), 'src/simple_vault.idl.json'), 'utf8'))
const provider = new anchor.AnchorProvider(connection, new anchor.Wallet(owner), { commitment: 'confirmed' })
const program = new anchor.Program(idl, provider) as any
const programId: PublicKey = program.programId

const pda = (seeds: Buffer[]) => PublicKey.findProgramAddressSync(seeds, programId)[0]
const exists = async (k: PublicKey) => (await connection.getAccountInfo(k)) !== null
const bal = async (k: PublicKey) => (await connection.getTokenAccountBalance(k)).value.amount

const main = async () => {
  const vaultState = pda([Buffer.from('vault'), TOKEN_A.toBuffer()])
  const vaultTokenAccount = pda([Buffer.from('vault_tokens'), TOKEN_A.toBuffer()])
  const shareMint = pda([Buffer.from('share_mint'), TOKEN_A.toBuffer()])
  const vaultSecond = pda([Buffer.from('vault_second'), vaultState.toBuffer(), TOKEN_B.toBuffer()])
  const userCard = pda([Buffer.from('user_card'), vaultState.toBuffer(), owner.publicKey.toBuffer()])

  if (!(await exists(vaultState))) {
    const tx = await program.methods.initializeVault().accountsPartial({
      vaultState, vaultTokenAccount, shareMint, tokenMint: TOKEN_A, admin: owner.publicKey,
      tokenProgram: TOKEN_PROGRAM_ID, systemProgram: SystemProgram.programId, rent: SYSVAR_RENT_PUBKEY,
    }).rpc()
    console.log('initialize_vault:', tx)
  } else console.log('vault already exists')

  if (!(await exists(vaultSecond))) {
    const tx = await program.methods.initSecondStorage().accountsPartial({
      admin: owner.publicKey, vaultState, secondMint: TOKEN_B, vaultSecondAccount: vaultSecond,
      tokenProgram: TOKEN_PROGRAM_ID, systemProgram: SystemProgram.programId,
    }).rpc()
    console.log('init_second_storage:', tx)
  } else console.log('second storage already exists')

  if (!(await exists(userCard))) {
    const tx = await program.methods.createUserCard().accountsPartial({
      vaultState, userCard, user: owner.publicKey, systemProgram: SystemProgram.programId,
    }).rpc()
    console.log('create_user_card:', tx)
  }

  const userTokenA = await getOrCreateAssociatedTokenAccount(connection, owner, TOKEN_A, owner.publicKey)
  const userShare = await getOrCreateAssociatedTokenAccount(connection, owner, shareMint, owner.publicKey)

  if ((await bal(vaultTokenAccount)) === '0') {
    const tx = await program.methods.deposit(DEPOSIT).accountsPartial({
      vaultState, vaultTokenAccount, shareMint, userCard,
      userTokenAccount: userTokenA.address, userShareAccount: userShare.address,
      user: owner.publicKey, tokenProgram: TOKEN_PROGRAM_ID,
    }).rpc()
    console.log('deposit:', tx)
  }

  console.log('--- VAULT FOR WEEK 12 ---')
  console.log('vault_state:', vaultState.toBase58())
  console.log('vault TKA storage:', vaultTokenAccount.toBase58(), 'balance', await bal(vaultTokenAccount))
  console.log('vault TKB storage:', vaultSecond.toBase58(), 'balance', await bal(vaultSecond))
  process.exit()
}

main().catch((e) => { console.error(e); process.exit(1) })
