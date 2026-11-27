# Liquidity Vault — веб-интерфейс

React + Vite, `@solana/web3.js` 1.x, Wallet Adapter (Phantom / Solflare), Anchor 0.31.1, Raydium SDK v2. Сеть: devnet.

```bash
npm install
npm run dev     # http://localhost:5173
```

| Файл | Что внутри |
|---|---|
| `src/vault.ts` | адреса devnet, PDA vault, форматирование сумм |
| `src/idl.ts` | IDL программы `simple_vault` (из `target/idl`) |
| `src/App.tsx` | страница пользователя: кошелёк, vault, карточка, «Внести», «Вывести», история транзакций |
| `src/Admin.tsx` | страница администратора: позиции, сбор комиссий, закрытие, открытие, обмен |
| `src/raydium.ts` | расчёты Raydium CLMM (тики, ликвидность, симуляция обмена, поиск позиций vault) |

Подробное описание продукта — в `README.md` в корне репозитория.
