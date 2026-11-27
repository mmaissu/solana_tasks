import { useCallback, useEffect, useState } from 'react'
import { ComputeBudgetProgram, Keypair, PublicKey, SystemProgram, SYSVAR_RENT_PUBKEY, type Connection } from '@solana/web3.js'
import { ASSOCIATED_TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID, TOKEN_PROGRAM_ID } from '@solana/spl-token'
import { BN } from '@coral-xyz/anchor'
import type Decimal from 'decimal.js'
import { MEMO_PROGRAM, POOL_ID, explorerAddr, short, toRaw, toUi } from './vault'
import {
  closeMins,
  findVaultPositions,
  loadPool,
  manageAccounts,
  openAccounts,
  planOpen,
  planSwap,
  type OpenPlan,
  type SwapDirection,
  type SwapPlan,
  type VaultPosition,
} from './raydium'

type Props = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  program: any
  connection: Connection
  admin: PublicKey
  run: (label: string, send: () => Promise<string>) => Promise<boolean>
  vaultTka: string // raw
  vaultTkb: string // raw
  busy: boolean
}

const cu = (units: number) => ComputeBudgetProgram.setComputeUnitLimit({ units })

export default function Admin({ program, connection, admin, run, vaultTka, vaultTkb, busy }: Props) {
  const [price, setPrice] = useState<Decimal | null>(null)
  const [poolKeys, setPoolKeys] = useState<{ vault: { A: string; B: string } } | null>(null)
  const [positions, setPositions] = useState<VaultPosition[] | null>(null)
  const [error, setError] = useState('')
  const [calcBusy, setCalcBusy] = useState(false)

  const [rangePct, setRangePct] = useState('10')
  const [openTkb, setOpenTkb] = useState('')
  const [openPlan, setOpenPlan] = useState<OpenPlan | null>(null)

  const [direction, setDirection] = useState<SwapDirection>('TKA_TO_TKB')
  const [swapAmount, setSwapAmount] = useState('1')
  const [swapPlan, setSwapPlan] = useState<SwapPlan | null>(null)

  const load = useCallback(async () => {
    setError('')
    try {
      const pool = await loadPool(connection)
      setPrice(pool.tkbPerTka)
      setPoolKeys(pool.poolKeys)
      setPositions(await findVaultPositions(connection))
    } catch (e) {
      setError(`Не удалось загрузить данные Raydium: ${(e as Error).message}`)
    }
  }, [connection])

  useEffect(() => {
    load()
  }, [load])

  // default: 98% of vault TKB for a new position
  useEffect(() => {
    if (!openTkb && vaultTkb !== '0') setOpenTkb(toUi(new BN(vaultTkb).muln(98).divn(100)))
  }, [vaultTkb, openTkb])

  const calc = async (f: () => Promise<void>) => {
    setCalcBusy(true)
    setError('')
    try {
      await f()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setCalcBusy(false)
    }
  }

  // ---- actions ----
  const collect = async (pos: VaultPosition) => {
    if (!poolKeys) return
    const ok = await run(`Собрать комиссии ${short(pos.nftMint)}`, () =>
      program.methods
        .collectFees()
        .accountsPartial({
          admin,
          ...manageAccounts(pos, poolKeys),
          tokenProgram: TOKEN_PROGRAM_ID,
          tokenProgram2022: TOKEN_2022_PROGRAM_ID,
          memoProgram: MEMO_PROGRAM,
          systemProgram: SystemProgram.programId,
        })
        .preInstructions([cu(400_000)])
        .rpc(),
    )
    if (ok) load()
  }

  const close = async (pos: VaultPosition) => {
    if (!poolKeys || !price) return
    const m = closeMins(pos, price)
    const ok = await run(`Закрыть позицию ${short(pos.nftMint)}`, () =>
      program.methods
        .closeRaydiumPosition(m.min0, m.min1)
        .accountsPartial({
          admin,
          ...manageAccounts(pos, poolKeys),
          tokenProgram: TOKEN_PROGRAM_ID,
          tokenProgram2022: TOKEN_2022_PROGRAM_ID,
          memoProgram: MEMO_PROGRAM,
          systemProgram: SystemProgram.programId,
        })
        .preInstructions([cu(400_000)])
        .rpc(),
    )
    if (ok) {
      setOpenTkb('')
      setOpenPlan(null)
      load()
    }
  }

  const calcOpen = () =>
    calc(async () => {
      const pct = Number(rangePct)
      const base = toRaw(openTkb)
      if (!(pct > 0 && pct < 90) || !base) throw new Error('Проверьте диапазон (%) и количество TKB')
      setOpenPlan(await planOpen(connection, pct, base))
    })

  const open = async () => {
    if (!openPlan) return
    const p = openPlan
    if (p.max0.gt(new BN(vaultTkb)) || p.max1.gt(new BN(vaultTka))) {
      setError('В хранилищах vault меньше токенов, чем нужно для лимитов')
      return
    }
    const nftMint = Keypair.generate()
    const ok = await run('Открыть позицию', () =>
      program.methods
        .openRaydiumPosition(p.tickLower, p.tickUpper, p.taLower, p.taUpper, p.liquidity, p.max0, p.max1)
        .accountsPartial({
          admin,
          ...openAccounts(p, nftMint.publicKey),
          rent: SYSVAR_RENT_PUBKEY,
          systemProgram: SystemProgram.programId,
          tokenProgram: TOKEN_PROGRAM_ID,
          tokenProgram2022: TOKEN_2022_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        })
        .preInstructions([cu(600_000)])
        .signers([nftMint])
        .rpc(),
    )
    if (ok) {
      setOpenPlan(null)
      setOpenTkb('')
      load()
    }
  }

  const calcSwap = () =>
    calc(async () => {
      const amount = toRaw(swapAmount)
      if (!amount) throw new Error('Введите количество')
      setSwapPlan(await planSwap(connection, direction, amount))
    })

  const swap = async () => {
    if (!swapPlan) return
    const s = swapPlan
    const ok = await run(`Обмен ${toUi(s.amountIn)} ${s.direction === 'TKA_TO_TKB' ? 'TKA → TKB' : 'TKB → TKA'}`, () =>
      program.methods
        .swap(s.amountIn, s.minOut, new BN(0))
        .accountsPartial({
          admin,
          ...s.accounts,
          tokenProgram: TOKEN_PROGRAM_ID,
          tokenProgram2022: TOKEN_2022_PROGRAM_ID,
          memoProgram: MEMO_PROGRAM,
        })
        .remainingAccounts(s.remaining)
        .preInstructions([cu(400_000)])
        .rpc(),
    )
    if (ok) {
      setSwapPlan(null)
      setOpenTkb('')
      load()
    }
  }

  const inRange = (pos: VaultPosition) => !!price && price.gte(pos.low) && price.lte(pos.high)
  const disabled = busy || calcBusy

  return (
    <>
      {error && <div className="tx tx-error">⚠️ {error}</div>}

      <section className="card">
        <h2>Пул Raydium CLMM</h2>
        <div className="grid">
          <Stat label="Текущая цена" value={price ? `1 TKA = ${price.toFixed(4)} TKB` : '…'} />
          <Stat label="Комиссия пула" value="0,25%" />
        </div>
        <p className="muted small">
          Пул:{' '}
          <a href={explorerAddr(POOL_ID)} target="_blank" rel="noreferrer">
            {short(POOL_ID)}
          </a>
        </p>
      </section>

      <section className="card">
        <h2>Позиции vault</h2>
        {positions === null && <p className="muted">Загрузка…</p>}
        {positions?.length === 0 && <p className="muted">Открытых позиций нет.</p>}
        {positions?.map((pos) => {
          const m = price ? closeMins(pos, price) : null
          return (
            <div key={pos.nftMint.toBase58()} className="position">
              <div className="grid">
                <Stat label="NFT позиции" value={short(pos.nftMint)} />
                <Stat label="Диапазон (TKB за 1 TKA)" value={`${pos.low.toFixed(2)} – ${pos.high.toFixed(2)}`} />
                <Stat label="Статус" value={inRange(pos) ? '🟢 в диапазоне' : '🟠 вне диапазона'} />
                <Stat
                  label="Вернётся при закрытии (без комиссий)"
                  value={m ? `${toUi(m.expTka)} TKA + ${toUi(m.expTkb)} TKB` : '…'}
                />
              </div>
              <p className="muted small">
                Тики {pos.tickLower} … {pos.tickUpper} · ликвидность {pos.liquidity.toString()} ·{' '}
                <a href={explorerAddr(pos.nftMint)} target="_blank" rel="noreferrer">
                  Explorer
                </a>
              </p>
              <div className="actions">
                <button className="primary" onClick={() => collect(pos)} disabled={disabled}>
                  Собрать комиссии
                </button>
                <button onClick={() => close(pos)} disabled={disabled} className="secondary">
                  Закрыть позицию (минимум −1%)
                </button>
              </div>
            </div>
          )
        })}
      </section>

      <div className="two">
        <section className="card">
          <h2>Открыть позицию</h2>
          <label className="muted small">Диапазон: текущая цена ± %</label>
          <input value={rangePct} onChange={(e) => setRangePct(e.target.value)} inputMode="decimal" />
          <label className="muted small">Сколько TKB вложить (в vault {toUi(vaultTkb)})</label>
          <input value={openTkb} onChange={(e) => setOpenTkb(e.target.value)} inputMode="decimal" />
          <div className="actions">
            <button onClick={calcOpen} disabled={disabled} className="secondary">
              Рассчитать
            </button>
            <button className="primary" onClick={open} disabled={disabled || !openPlan}>
              Открыть
            </button>
          </div>
          {openPlan && (
            <div className="preview">
              <div>
                Диапазон: <b>{openPlan.low.toFixed(2)} – {openPlan.high.toFixed(2)}</b> TKB за 1 TKA (цена{' '}
                {openPlan.price.toFixed(2)})
              </div>
              <div>
                Уйдёт: <b>{toUi(openPlan.needTkb)} TKB</b> и <b>{toUi(openPlan.needTka)} TKA</b>
              </div>
              <div className="muted small">
                Лимиты (+1%): {toUi(openPlan.max0)} TKB / {toUi(openPlan.max1)} TKA · тики {openPlan.tickLower} …{' '}
                {openPlan.tickUpper}
              </div>
            </div>
          )}
        </section>

        <section className="card">
          <h2>Обмен (swap)</h2>
          <label className="muted small">Направление</label>
          <select
            value={direction}
            onChange={(e) => {
              setDirection(e.target.value as SwapDirection)
              setSwapPlan(null)
            }}
          >
            <option value="TKA_TO_TKB">TKA → TKB (в vault {toUi(vaultTka)} TKA)</option>
            <option value="TKB_TO_TKA">TKB → TKA (в vault {toUi(vaultTkb)} TKB)</option>
          </select>
          <label className="muted small">Сколько отдать</label>
          <input
            value={swapAmount}
            onChange={(e) => {
              setSwapAmount(e.target.value)
              setSwapPlan(null)
            }}
            inputMode="decimal"
          />
          <div className="actions">
            <button onClick={calcSwap} disabled={disabled} className="secondary">
              Рассчитать
            </button>
            <button className="primary" onClick={swap} disabled={disabled || !swapPlan}>
              Обменять
            </button>
          </div>
          {swapPlan && (
            <div className="preview">
              <div>
                Получите ≈ <b>{toUi(swapPlan.expectedOut)}</b> {swapPlan.direction === 'TKA_TO_TKB' ? 'TKB' : 'TKA'}
              </div>
              <div className="muted small">Минимум (slippage 1%): {toUi(swapPlan.minOut)}</div>
            </div>
          )}
        </section>
      </div>
    </>
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
