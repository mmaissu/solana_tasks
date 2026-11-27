# Solana — задания курса (Майра Сулеймен)

Все выполненные задания собраны здесь по неделям: **одна неделя — одна папка**. Код Liquidity Vault разрабатывается в отдельном репозитории [mmaissu/vault-dev](https://github.com/mmaissu/vault-dev), где на каждую неделю есть своя ветка. Готовая неделя копируется сюда целиком (`git archive` ветки → папка `week-N`), вместе со скриптами и README.

Сеть: Solana **devnet**. Стек: Anchor 0.31.1 (Rust), TypeScript, Raydium SDK v2, Raydium CLMM CPI.

## Оглавление

| Неделя | Дата (последний коммит работы) | Тема | Папка | Ветка в vault-dev |
|---|---|---|---|---|
| 8 | 16.10.2026 | Simple Vault: состояние, карточка пользователя, депозит | [week-8](./week-8) | [week-8](https://github.com/mmaissu/vault-dev/tree/week-8) |
| 9 | 23.10.2026 | Депозит через карточку пользователя, тесты | [week-9](./week-9) | [week-9](https://github.com/mmaissu/vault-dev/tree/week-9) |
| 10 | 30.10.2026 | Вывод средств и CPI | [week-10](./week-10) | [week-10](https://github.com/mmaissu/vault-dev/tree/week-10) |
| 11 | 01.11.2026 | Свои токены и CLMM-пул Raydium | [week-11](./week-11) | — (только скрипты) |
| 12 | 15.11.2026 | Обмен (swap) из vault через Raydium CLMM | [week-12](./week-12) | [week-12](https://github.com/mmaissu/vault-dev/tree/week-12) |
| 13 | 20.11.2026 | Позиция vault в CLMM-пуле: комиссии, закрытие, ребалансировка | [week-13](./week-13) | [week-13](https://github.com/mmaissu/vault-dev/tree/week-13) |
| 14 | 27.11.2026 | Capstone: веб-интерфейс Liquidity Vault (пользователь и администратор) | [week-14](./week-14) | [week-14](https://github.com/mmaissu/vault-dev/tree/week-14) |

Подробности, адреса и ссылки на транзакции в Explorer — в `README.md` внутри каждой папки.

## Что сделано по неделям

### Неделя 8 — Simple Vault
- Аккаунты `VaultState` (admin, token_mint, vault_token_account, share_mint, total_tokens, total_shares, bump, paused) и `UserCard` (vault, owner, created_at, deposited, shares, bump).
- Инструкции `initialize_vault`, `create_user_card`, `close_user_card`, `set_paused`, `deposit`.
- PDA: `["vault", token_mint]`, `["vault_tokens", token_mint]`, `["share_mint", token_mint]`, `["user_card", vault_state, user]`.

### Неделя 9 — депозит через карточку
- `deposit` требует карточку пользователя и обновляет в ней `deposited` и `shares`.
- Тесты и обновлённый README.

### Неделя 10 — вывод средств и CPI
- `withdraw`: сжигание shares (подписывает пользователь) и перевод токенов из vault (подписывает PDA `vault_state` через `CpiContext::new_with_signer`).
- Карточку с shares > 0 закрыть нельзя (`CardHasShares`).
- 18 интеграционных тестов, транзакция в devnet.

### Неделя 11 — свои токены и CLMM-пул
- Тестовые токены TKA `58yZV9EGzxW1b7xBhMKC7VAMq5599VCdhMQ351eqmGyR` и TKB `trXbiGdDwxDCpKotLVBns8ueu1aagEwjb17YFT3XN3e`.
- CLMM-пул Raydium `5Bpew1UyKwP9YcZNxS4XhouCc5inW4ooF7MeCRYSZwZp` (комиссия 0,25%, tickSpacing 60, начальная цена 1 TKA = 100 TKB).
- Личная позиция в диапазоне 90–110 TKB за 1 TKA.

### Неделя 12 — swap из vault
- `init_second_storage`: второе хранилище vault для TKB (PDA `["vault_second", vault_state, second_mint]`).
- `swap`: только админ, CPI в Raydium `swap_v2`, подписывает PDA vault, обязательная защита от slippage.
- Результат: 1 TKA → 99,269912 TKB; отклонённый обмен с ошибкой slippage `TooLittleOutputReceived` (6018).

### Неделя 13 — позиция vault в CLMM-пуле
- `open_raydium_position`, `collect_fees`, `close_raydium_position` (только админ, NFT позиции принадлежит PDA vault).
- Сценарий в devnet: открыть → обмены с другого кошелька → собрать комиссии → закрыть; затем ребалансировка (цена 99 → 109,5, старая позиция закрыта, новая открыта вокруг новой цены).
- Всего собрано комиссий: 0,000549 TKA и 0,257857 TKB.

### Неделя 14 — Capstone: веб-интерфейс
- Веб-приложение (React + Vite) в папке `app/`: подключение Phantom / Solflare (devnet), балансы пользователя и share-токенов, состояние vault.
- Пользователь: создать карточку, внести, вывести; статус транзакции и ссылка на Explorer, история транзакций.
- Администратор: позиции vault в Raydium, сбор комиссий, закрытие и открытие позиции, обмен TKA ↔ TKB.
- README продукта: запуск, адреса devnet, схема аккаунтов, ссылки на транзакции через интерфейс.

## Основные адреса (devnet)

| Что | Адрес |
|---|---|
| Программа simple_vault | [`25exdZUmhe6Xah5wxHrXf1w851F3Da36tb4W2E6fG6L4`](https://explorer.solana.com/address/25exdZUmhe6Xah5wxHrXf1w851F3Da36tb4W2E6fG6L4?cluster=devnet) |
| vault_state (vault для TKA) | [`AhcvxRaZ7Pbs3zZNug3FCD6wdgvD5djteBvpj5RqW43q`](https://explorer.solana.com/address/AhcvxRaZ7Pbs3zZNug3FCD6wdgvD5djteBvpj5RqW43q?cluster=devnet) |
| CLMM-пул TKB/TKA | [`5Bpew1UyKwP9YcZNxS4XhouCc5inW4ooF7MeCRYSZwZp`](https://explorer.solana.com/address/5Bpew1UyKwP9YcZNxS4XhouCc5inW4ooF7MeCRYSZwZp?cluster=devnet) |
| Raydium CLMM (devnet) | `DRayAUgENGQBKVaX8owNhgzkEDyoHTGVEGHVJT1E9pfH` |

## Как устроен репозиторий

```
solana_tasks/
├── week-8/     ┐
├── week-9/     │ снимки веток vault-dev: programs/, tests/, scripts/, README.md
├── week-10/    │
├── week-11/    │ (неделя 11 — скрипты Raydium SDK)
├── week-12/    │
├── week-13/    ┘
└── week-14/    capstone: программа + веб-интерфейс (app/)
```

Ключи кошельков и программ в репозиторий не попадают: перед каждым коммитом папка проверяется на файлы `*keypair*`.
