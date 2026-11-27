import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAnchorWallet, useConnection, useWallet } from '@solana/wallet-adapter-react'
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui'
import { AnchorProvider, BN, Program, type Idl } from '@coral-xyz/anchor'
import { LAMPORTS_PER_SOL, PublicKey, SystemProgram } from '@solana/web3.js'
import {
  TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountIdempotentInstruction,
  getAssociatedTokenAddressSync,
} from '@solana/spl-token'
import { IDL } from './idl'
import Admin from './Admin'
import {
  SHARE_MINT,
  TKA_MINT,
  VAULT_SECOND,
  VAULT_STATE,
  VAULT_TOKENS,
  explorerAddr,
  explorerTx,
  short,
  toRaw,
  toUi,
  userCardPda,
} from './vault'

type TxState =
  | { status: 'idle' }
  | { status: 'pending'; label: string }
  | { status: 'ok'; label: string; sig: string }
  | { status: 'error'; label: string; message: string; logs: string[] }

type VaultInfo = {
  admin: PublicKey
  totalTokens: BN
  totalShares: BN
  paused: boolean
  tka: string // raw balance of the TKA storage
  tkb: string // raw balance of the TKB storage
}

type UserInfo = {
  sol: number
  tka: BN
  shares: BN
  card: null | { deposited: BN; shares: BN; createdAt: number }
}

const rawBalance = async (conn: ReturnType<typeof useConnection>['connection'], acc: PublicKey) => {
  try {
    return new BN((await conn.getTokenAccountBalance(acc)).value.amount)
  } catch {
    return new BN(0) // account does not exist yet
  }
}

export default function App() {
  const { connection } = useConnection()
  const anchorWallet = useAnchorWallet()
  const { publicKey } = useWallet()

  const [tab, setTab] = useState<'user' | 'admin'>('user')
  const [vault, setVault] = useState<VaultInfo | null>(null)
  const [user, setUser] = useState<UserInfo | null>(null)
  const [tx, setTx] = useState<TxState>({ status: 'idle' })
  const [depositAmount, setDepositAmount] = useState('')
  const [withdrawAmount, setWithdrawAmount] = useState('')
  const [loading, setLoading] = useState(false)
  const [history, setHistory] = useState<{ label: string; sig: string; time: string }[]>([])

  // Anchor program; without a wallet a read-only dummy wallet is used
  const program = useMemo(() => {
    const wallet =
      anchorWallet ??
      ({
        publicKey: PublicKey.default,
        signTransaction: async (t: unknown) => t,
        signAllTransactions: async (t: unknown) => t,
      } as never)
    const provider = new AnchorProvider(connection, wallet, { commitment: 'confirmed' })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return new Program(IDL as unknown as Idl, provider) as any
  }, [connection, anchorWallet])

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const vs = await program.account.vaultState.fetch(VAULT_STATE)
      const [tka, tkb] = await Promise.all([
        rawBalance(connection, VAULT_TOKENS),
        rawBalance(connection, VAULT_SECOND),
      ])
      setVault({
        admin: vs.admin,
        totalTokens: vs.totalTokens,
        totalShares: vs.totalShares,
        paused: vs.paused,
        tka: tka.toString(),
        tkb: tkb.toString(),
      })

      if (publicKey) {
        const [sol, userTka, userShares, card] = await Promise.all([
          connection.getBalance(publicKey),
          rawBalance(connection, getAssociatedTokenAddressSync(TKA_MINT, publicKey)),
          rawBalance(connection, getAssociatedTokenAddressSync(SHARE_MINT, publicKey)),
          program.account.userCard.fetchNullable(userCardPda(publicKey)),
        ])
        setUser({
          sol: sol / LAMPORTS_PER_SOL,
          tka: userTka,
          shares: userShares,
          card: card
            ? { deposited: card.deposited, shares: card.shares, createdAt: card.createdAt.toNumber() }
            : null,
        })
      } else {
        setUser(null)
      }
    } catch (e) {
      console.error('refresh failed', e)
    } finally {
      setLoading(false)
    }
  }, [program, connection, publicKey])

  useEffect(() => {
    refresh()
  }, [refresh])

  // Send a transaction and show its status
  const run = async (label: string, send: () => Promise<string>): Promise<boolean> => {
    setTx({ status: 'pending', label })
    try {
      const sig = await send()
      setTx({ status: 'ok', label, sig })
      setHistory((h) => [{ label, sig, time: new Date().toLocaleTimeString() }, ...h])
      await refresh()
      return true
    } catch (e: unknown) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const err = e as any
      const message = err?.error?.errorMessage ?? err?.message ?? String(e)
      const logs: string[] = err?.logs ?? err?.transactionLogs ?? []
      setTx({ status: 'error', label, message, logs })
      return false
    }
  }

  const isAdmin = !!(publicKey && vault && vault.admin.equals(publicKey))

  // ---- user actions ----
  const userAccounts = (pk: PublicKey) => ({
    vaultState: VAULT_STATE,
    userCard: userCardPda(pk),
    vaultTokenAccount: VAULT_TOKENS,
    shareMint: SHARE_MINT,
    userTokenAccount: getAssociatedTokenAddressSync(TKA_MINT, pk),
    userShareAccount: getAssociatedTokenAddressSync(SHARE_MINT, pk),
    user: pk,
    tokenProgram: TOKEN_PROGRAM_ID,
  })

  const createCard = () =>
    run('Создать карточку', () =>
      program.methods
        .createUserCard()
        .accountsPartial({
          vaultState: VAULT_STATE,
          userCard: userCardPda(publicKey!),
          user: publicKey!,
          systemProgram: SystemProgram.programId,
        })
        .rpc(),
    )

  const deposit = () => {
    const amount = toRaw(depositAmount)
    if (!amount || !publicKey) return
    const acc = userAccounts(publicKey)
    run(`Внести ${depositAmount} TKA`, () =>
      program.methods
        .deposit(amount)
        .accountsPartial(acc)
        // share account of the user is created if it does not exist yet
        .preInstructions([
          createAssociatedTokenAccountIdempotentInstruction(publicKey, acc.userShareAccount, publicKey, SHARE_MINT),
        ])
        .rpc(),
    )
  }

  const withdraw = () => {
    const shares = toRaw(withdrawAmount)
    if (!shares || !publicKey) return
    const acc = userAccounts(publicKey)
    run(`Вывести ${withdrawAmount} shares`, () =>
      program.methods
        .withdraw(shares)
        .accountsPartial(acc)
        .preInstructions([
          createAssociatedTokenAccountIdempotentInstruction(publicKey, acc.userTokenAccount, publicKey, TKA_MINT),
        ])
        .rpc(),
    )
  }

  const closeCard = () =>
    run('Закрыть карточку', () =>
      program.methods
        .closeUserCard()
        .accountsPartial({ vaultState: VAULT_STATE, userCard: userCardPda(publicKey!), user: publicKey! })
        .rpc(),
    )

  // ---- derived numbers ----
  const sharePrice =
    vault && !vault.totalShares.isZero()
      ? Number(vault.totalTokens.toString()) / Number(vault.totalShares.toString())
      : 1
  const depositRaw = toRaw(depositAmount)
  const withdrawRaw = toRaw(withdrawAmount)
  const expectedShares =
    depositRaw && vault
      ? vault.totalShares.isZero() || vault.totalTokens.isZero()
        ? depositRaw
        : depositRaw.mul(vault.totalShares).div(vault.totalTokens)
      : null
  const expectedTokens =
    withdrawRaw && vault && !vault.totalShares.isZero()
      ? withdrawRaw.mul(vault.totalTokens).div(vault.totalShares)
      : null
  const busy = tx.status === 'pending'

  return (
    <div className="page">
      <header className="header">
        <div>
          <h1>Liquidity Vault</h1>
          <span className="badge">devnet</span>
        </div>
        <WalletMultiButton />
      </header>

      <nav className="tabs">
        <button className={tab === 'user' ? 'active' : ''} onClick={() => setTab('user')}>
          Пользователь
        </button>
        <button className={tab === 'admin' ? 'active' : ''} onClick={() => setTab('admin')}>
          Администратор
        </button>
        <button className="refresh" onClick={refresh} disabled={loading}>
          {loading ? 'Обновляю…' : '↻ Обновить'}
        </button>
      </nav>

      {tx.status !== 'idle' && (
        <div className={`tx tx-${tx.status}`}>
          {tx.status === 'pending' && <>⏳ {tx.label}: подтвердите в кошельке и дождитесь подтверждения сети…</>}
          {tx.status === 'ok' && (
            <>
              ✅ {tx.label}: успешно.{' '}
              <a href={explorerTx(tx.sig)} target="_blank" rel="noreferrer">
                Открыть в Explorer
              </a>
            </>
          )}
          {tx.status === 'error' && (
            <>
              ❌ {tx.label}: {tx.message}
              {tx.logs.length > 0 && (
                <details>
                  <summary>Логи программы</summary>
                  <pre>{tx.logs.join('\n')}</pre>
                </details>
              )}
            </>
          )}
        </div>
      )}

      <section className="card">
        <h2>Vault</h2>
        {vault ? (
          <div className="grid">
            <Stat label="Всего внесено (total_tokens)" value={`${toUi(vault.totalTokens)} TKA`} />
            <Stat label="Всего shares" value={toUi(vault.totalShares)} />
            <Stat label="Цена 1 share" value={`${sharePrice.toFixed(6)} TKA`} />
            <Stat label="Хранилище TKA (доступно для вывода)" value={`${toUi(vault.tka)} TKA`} />
            <Stat label="Хранилище TKB" value={`${toUi(vault.tkb)} TKB`} />
            <Stat label="Статус" value={vault.paused ? 'на паузе' : 'работает'} />
          </div>
        ) : (
          <p className="muted">Загрузка данных vault…</p>
        )}
        <p className="muted small">
          Vault:{' '}
          <a href={explorerAddr(VAULT_STATE)} target="_blank" rel="noreferrer">
            {short(VAULT_STATE)}
          </a>
          {vault && (
            <>
              {' '}
              · админ:{' '}
              <a href={explorerAddr(vault.admin)} target="_blank" rel="noreferrer">
                {short(vault.admin)}
              </a>
            </>
          )}
        </p>
      </section>

      {tab === 'user' && (
        <>
          {!publicKey ? (
            <section className="card">
              <p>Подключите кошелёк Phantom или Solflare (сеть devnet), чтобы внести или вывести токены.</p>
            </section>
          ) : (
            <>
              <section className="card">
                <h2>Мой кошелёк</h2>
                {user ? (
                  <div className="grid">
                    <Stat label="SOL" value={user.sol.toFixed(4)} />
                    <Stat label="TKA" value={toUi(user.tka)} />
                    <Stat label="Мои shares" value={toUi(user.shares)} />
                    <Stat label="Стоимость моих shares" value={`${(Number(toUi(user.shares)) * sharePrice).toFixed(6)} TKA`} />
                    <Stat label="Внесено всего (карточка)" value={user.card ? `${toUi(user.card.deposited)} TKA` : '—'} />
                    <Stat
                      label="Карточка создана"
                      value={user.card ? new Date(user.card.createdAt * 1000).toLocaleString() : 'нет карточки'}
                    />
                  </div>
                ) : (
                  <p className="muted">Загрузка…</p>
                )}
              </section>

              {user && !user.card && (
                <section className="card">
                  <h2>Шаг 1. Карточка пользователя</h2>
                  <p className="muted">Перед первым депозитом нужно создать личную карточку в vault (один раз).</p>
                  <button className="primary" onClick={createCard} disabled={busy}>
                    Создать карточку
                  </button>
                </section>
              )}

              {user && user.card && (
                <div className="two">
                  <section className="card">
                    <h2>Внести</h2>
                    <input
                      value={depositAmount}
                      onChange={(e) => setDepositAmount(e.target.value)}
                      placeholder="Сколько TKA"
                      inputMode="decimal"
                    />
                    <div className="row">
                      <button className="link" onClick={() => setDepositAmount(toUi(user.tka))}>
                        макс: {toUi(user.tka)}
                      </button>
                      {expectedShares && <span className="muted">получите ≈ {toUi(expectedShares)} shares</span>}
                    </div>
                    <button
                      className="primary"
                      onClick={deposit}
                      disabled={busy || !depositRaw || depositRaw.gt(user.tka)}
                    >
                      Внести
                    </button>
                    {depositRaw && depositRaw.gt(user.tka) && <p className="warn">Не хватает TKA в кошельке</p>}
                  </section>

                  <section className="card">
                    <h2>Вывести</h2>
                    <input
                      value={withdrawAmount}
                      onChange={(e) => setWithdrawAmount(e.target.value)}
                      placeholder="Сколько shares"
                      inputMode="decimal"
                    />
                    <div className="row">
                      <button className="link" onClick={() => setWithdrawAmount(toUi(user.shares))}>
                        все: {toUi(user.shares)}
                      </button>
                      {expectedTokens && <span className="muted">получите ≈ {toUi(expectedTokens)} TKA</span>}
                    </div>
                    <button
                      className="primary"
                      onClick={withdraw}
                      disabled={busy || !withdrawRaw || withdrawRaw.gt(user.shares)}
                    >
                      Вывести
                    </button>
                    {withdrawRaw && withdrawRaw.gt(user.shares) && <p className="warn">У вас меньше shares</p>}
                    {expectedTokens && vault && expectedTokens.gt(new BN(vault.tka)) && (
                      <p className="warn">
                        В хранилище vault сейчас меньше TKA: часть средств в позиции Raydium. Админ должен закрыть
                        позицию.
                      </p>
                    )}
                  </section>
                </div>
              )}

              {user && user.card && user.card.shares.isZero() && user.shares.isZero() && (
                <section className="card">
                  <h2>Закрыть карточку</h2>
                  <p className="muted">Shares нет — карточку можно закрыть и вернуть rent.</p>
                  <button onClick={closeCard} disabled={busy}>
                    Закрыть карточку
                  </button>
                </section>
              )}
            </>
          )}
        </>
      )}

      {tab === 'admin' && !isAdmin && (
        <section className="card">
          <h2>Администратор</h2>
          {!publicKey && <p>Подключите кошелёк администратора.</p>}
          {publicKey && vault && (
            <p className="warn">
              Подключённый кошелёк {short(publicKey)} — не администратор vault (админ: {short(vault.admin)}).
            </p>
          )}
        </section>
      )}
      {tab === 'admin' && isAdmin && vault && publicKey && (
        <Admin
          program={program}
          connection={connection}
          admin={publicKey}
          run={run}
          vaultTka={vault.tka}
          vaultTkb={vault.tkb}
          busy={busy}
        />
      )}

      {history.length > 0 && (
        <section className="card">
          <h2>История транзакций (эта сессия)</h2>
          <ul className="history">
            {history.map((h) => (
              <li key={h.sig}>
                <span className="muted small">{h.time}</span> {h.label} —{' '}
                <a href={explorerTx(h.sig)} target="_blank" rel="noreferrer">
                  {short(h.sig)}
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}

      <footer className="muted small">
        Программа:{' '}
        <a href={explorerAddr(program.programId)} target="_blank" rel="noreferrer">
          {program.programId.toBase58()}
        </a>
      </footer>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="stat">
      <div className="muted small">{label}</div>
      <div className="value">{value}</div>
    </div>
  )
}
