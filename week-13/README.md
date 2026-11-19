# Неделя 13 — позиция vault в CLMM-пуле Raydium

Vault сам становится провайдером ликвидности: открывает позицию в CLMM-пуле Raydium (devnet), собирает комиссии, закрывает позицию и делает ребалансировку. Все действия выполняет только администратор, NFT позиции принадлежит PDA `vault_state`.

## Адреса (devnet)

| Что | Адрес |
|---|---|
| Программа simple_vault | [`25exdZUmhe6Xah5wxHrXf1w851F3Da36tb4W2E6fG6L4`](https://explorer.solana.com/address/25exdZUmhe6Xah5wxHrXf1w851F3Da36tb4W2E6fG6L4?cluster=devnet) |
| Деплой обновления недели 13 | [`5SVVio9R…`](https://explorer.solana.com/tx/5SVVio9RyvpmdD46trC3GHfWr5MA7DzXokr4PfFfDaXxmSnGrf4ZaDnBuFUsGThovgspFZXaqHKrNmvAnvSkS1EQ?cluster=devnet) |
| vault_state (PDA, владелец NFT позиций) | [`AhcvxRaZ7Pbs3zZNug3FCD6wdgvD5djteBvpj5RqW43q`](https://explorer.solana.com/address/AhcvxRaZ7Pbs3zZNug3FCD6wdgvD5djteBvpj5RqW43q?cluster=devnet) |
| Хранилище TKA (первый токен) | [`4jfw68Db59tUdea3Vc1nTdPwMPupRFuBPz5ozq9swBGR`](https://explorer.solana.com/address/4jfw68Db59tUdea3Vc1nTdPwMPupRFuBPz5ozq9swBGR?cluster=devnet) |
| Хранилище TKB (второй токен) | [`6xSU2MscpcFgCoXCkPFCkv4cetumbwogmc26eAfTexp9`](https://explorer.solana.com/address/6xSU2MscpcFgCoXCkPFCkv4cetumbwogmc26eAfTexp9?cluster=devnet) |
| CLMM-пул TKB/TKA (комиссия 0,25%, tickSpacing 60) | [`5Bpew1UyKwP9YcZNxS4XhouCc5inW4ooF7MeCRYSZwZp`](https://explorer.solana.com/address/5Bpew1UyKwP9YcZNxS4XhouCc5inW4ooF7MeCRYSZwZp?cluster=devnet) |
| TKA | `58yZV9EGzxW1b7xBhMKC7VAMq5599VCdhMQ351eqmGyR` |
| TKB | `trXbiGdDwxDCpKotLVBns8ueu1aagEwjb17YFT3XN3e` |
| Кошелёк «трейдер» (обмены) | `Eg3Wwj9U7Fs2Czxr6Ytajz7vYr6yyhsetB78pfA6oLDu` |

Raydium сортирует пару по адресу: token0 (mintA) = TKB, token1 (mintB) = TKA. Цены ниже указаны в TKB за 1 TKA.

## Что добавлено в контракт

`programs/simple_vault/src/instructions/open_position.rs`, `close_position.rs`, `lib.rs`:

| Инструкция | Что делает |
|---|---|
| `open_raydium_position(tick_lower, tick_upper, tick_array_lower_start, tick_array_upper_start, liquidity, amount_0_max, amount_1_max)` | CPI `open_position_with_token22_nft`. TKA берётся из `vault_token_account`, TKB — из `vault_second` (неделя 12). NFT (Token-2022) получает `vault_state`. `amount_0_max` / `amount_1_max` — максимум, который vault готов отдать. |
| `collect_fees()` | CPI `decrease_liquidity_v2` с `liquidity = 0`, минимумы 0: забирает накопленные комиссии, позиция не меняется. В лог пишет, сколько пришло. |
| `close_raydium_position(amount_0_min, amount_1_min)` | CPI `decrease_liquidity_v2` на всю ликвидность с минимумами, затем `close_position` (NFT сжигается). В лог пишет, сколько каждого токена вернулось. |

Детали реализации:
- Все три инструкции только для админа: `constraint = vault_state.admin == admin.key()`.
- Проверяется, что mint'ы пула — это ровно токены vault (ошибка `InvalidPoolMints`), и порядок token0/token1 определяется автоматически.
- Raydium списывает токены при открытии от имени `payer`. Платить rent `vault_state` не может (это аккаунт программы с данными), поэтому vault на время CPI делает `approve` админу ровно на `amount_*_max` и сразу после CPI `revoke`. Всё это происходит в одной транзакции.
- `base_flag = None`: используется `liquidity`, посчитанная в SDK, а `amount_*_max` служат лимитами (расчёт + 1%).
- `protocol_position` передаётся отдельным `mut`-аккаунтом (адрес из `getPdaProtocolPositionAddress`).
- Аккаунты в `Box<...>`, сборка без предупреждений `Stack offset`.
- При закрытии rent за NFT и `personal_position` возвращается владельцу NFT, то есть остаётся на PDA `vault_state`, а не у админа.

## Выбранный диапазон

Правило: текущая цена ±10%. Объём ограничен TKB в vault: в позицию идёт 98% TKB, нужное количество TKA считает SDK.

| Позиция | NFT | Цена при открытии | Диапазон (TKB за 1 TKA) | Тики |
|---|---|---|---|---|
| 1 | `5fAvqJXue4JeFjNJ4UzD7xtYFHPsgL417rCrdJLhZtBk` | 99,0397 | 89,1358 – 108,9437 | −46920 … −44940 |
| 2 | `8nZ4jjckhbZ7hEb87mExFMgeXzYGadaN4oWqKFcA7hQG` | 99,0332 | 89,1299 – 108,9366 | −46920 … −44940 |
| 3 (после ребалансировки, открыта) | `9Ywov2racVdK61fjAGixr9k93Rk5wgc1DUurVdacKc8E` | 109,5289 | 98,5760 – 120,4818 | −47940 … −45960 |

## Сценарий 1: открыть → обмены → собрать комиссии → закрыть

| Шаг | TKA | TKB | Транзакция |
|---|---|---|---|
| Открытие, вложено | 0,930433 | 97,284513 | [4SKk1miZ…](https://explorer.solana.com/tx/4SKk1miZdJo59GhyhTs1dg4xtb5e8mQrmB4ar7CpENAK3MdhSh11RFo7Swgqsnibhqv9jg2c2wGeL4keF4HMgbhN?cluster=devnet) |
| 6 обменов трейдера (3 раза: 1 TKA → TKB → TKA) | | | например [3XaZz9Aq…](https://explorer.solana.com/tx/3XaZz9AqDgB79TmEcciwSLmyTT5dXhwk1jLSXcmvNZgDWH1HZn8FjPLV6vUJEKYQvGSCYz1peViqnhmZQksRxfA8?cluster=devnet), [4iynrfiy…](https://explorer.solana.com/tx/4iynrfiypLXFm2sdz2hfKKegNzrKsJjoSWE1UmMToZSKazsA8zQshKBuykbuDAqqCgR6EbwEigopUjMDDfeWTKzN?cluster=devnet) |
| **Собрано комиссий** | **0,000549** | **0,054045** | [5xNW7TrG…](https://explorer.solana.com/tx/5xNW7TrGq3o27jU65pkhbegxEztg2oHHogtXHokfe8qPWZPG2m6CyWohKcpyC8U8HUPqHB5PEa52pxwshjUMyy8p?cluster=devnet) |
| Закрытие, вернулось (минимумы 0,921771 TKA / 96,24797 TKB) | 0,931082 | 97,220172 | [58eesJij…](https://explorer.solana.com/tx/58eesJijbPGrS4zVyzmimHRX2NvAFFTyZVxx5Yh38LQqUQuecz4FMiFbLFtDpA6pRY1yYezegq8eEXuNYJfPmsQ6?cluster=devnet) |

Цена почти не изменилась (99,0397 → 99,0332), поэтому вернулось почти столько же, сколько вошло. Плюс комиссии ≈ 0,108 TKB по текущей цене. Vault получил примерно 1/10 всех комиссий пула: в том же диапазоне работает моя личная позиция из недели 11, она примерно в 10 раз крупнее.

## Сценарий 2: ребалансировка

1. Открыта позиция 2 около цены 99,03 (диапазон 89,13–108,94): вложено 0,931602 TKA и 97,274423 TKB, [4pLSs8A6…](https://explorer.solana.com/tx/4pLSs8A6q4PGc4f7d85v6nFUdRRphY6Fnhdqak7rE8a5gPgJPRXaEvzXF69Bf2Li2B4y3mTcuReybBQE99GL6ySg?cluster=devnet).
2. Трейдер продал около 1160 TKB (35 обменов), цена выросла 99,03 → **109,53**, то есть выше верхней границы 108,94. Первый обмен: [4gyK7684…](https://explorer.solana.com/tx/4gyK7684dqjtwEVfh9nVNkGzF437iQeP2koExxjmEVpL5r3biAHyvFyMKrNciNf53ZPZvNFAkYuYMBVT1VmAiozj?cluster=devnet), последний: [2QytyCEa…](https://explorer.solana.com/tx/2QytyCEaGgJXoBLmjhG9pn7ui96YBBxP2Ubo7ivrRctjZYGdftihfsNxwfvppjos9Uh94pWAjPVA7UVvWa49QapB?cluster=devnet). После 108,94 цена стала двигаться быстрее (0,092 → 0,101 за 10 TKB): ликвидность vault вышла из диапазона.
3. **Собрано комиссий: 0 TKA, 0,203812 TKB**, [31cr95dU…](https://explorer.solana.com/tx/31cr95dU8ThNmPPXNM7rzinqPQH7fcETC9CDWVDorNFG9qYWaetRo3uZE3JH1QMmBWbKb3NR398czeXtf5mbGXg7?cluster=devnet).
4. Закрытие вне диапазона: **вернулось 0 TKA и 194,085435 TKB**, [2VVpavfp…](https://explorer.solana.com/tx/2VVpavfp65yKXJQQoobFWrZHmMcDph7iq91UzWZvDFMTDJj17r9ZpxJ9prRuBe6kZXo1svkYHSAR6bXcibzzGeB2?cluster=devnet). Пока цена росла, позиция продала весь свой TKA за TKB.
5. Открыта позиция 3 вокруг новой цены 109,53 (диапазон 98,58–120,48): вложено 1,707582 TKA и 192,348951 TKB, [2giXAfbH…](https://explorer.solana.com/tx/2giXAfbHBHrr9E9kLTAWQQgVLXDTs1SJQ5VmJVQ9mG4jzwYQbYKpF4hk4bApNzbWYp61xggrUBB7ev1mCAYqXrnb?cluster=devnet).

## Итог по комиссиям

| | TKA | TKB |
|---|---|---|
| Позиция 1 | 0,000549 | 0,054045 |
| Позиция 2 | 0 | 0,203812 |
| **Всего** | **0,000549** | **0,257857** |

По балансам vault: до недели 13 было 999 TKA и 99,269912 TKB; после закрытия позиции 2 (до открытия позиции 3) — 998,069596 TKA и 196,27444 TKB. После роста цены на ~10,6% vault держит меньше TKA и больше TKB: позиция продавала дорожающий TKA. По цене 109,53 это примерно на 4,9 TKB меньше, чем если бы vault просто держал токены (непостоянные потери, impermanent loss). Комиссии (~0,31 TKB) покрыли только часть этой разницы, потому что пул тонкий и объём обменов был небольшим.

## Скрипты (`scripts/`, запуск из `~/raydium-sdk-V2-demo`)

| Скрипт | Назначение |
|---|---|
| `week13-open-position.ts` | открыть позицию vault: диапазон = цена ±`RANGE_PCT`% (по умолчанию 10), `DRY_RUN=1` — только расчёт |
| `week13-manage-position.ts` | `ACTION=collect` — собрать комиссии, `ACTION=close` — закрыть с минимумами (расчёт − 1%) |
| `week13-trader-swaps.ts` | обмены туда-обратно с кошелька трейдера (`ROUNDS`, `AMOUNT_TKA`) |
| `week13-move-price.ts` | трейдер двигает цену до `TARGET` (для теста ребалансировки) |
| `week13-results.json`, `week13-position*.json` | сохранённые результаты (только публичные ключи и подписи) |

```bash
cd ~/raydium-sdk-V2-demo
KEYPAIR=~/.config/solana/id.json RPC_URL=https://api.devnet.solana.com npx tsx src/clmm/week13-open-position.ts
KEYPAIR=~/.config/solana/trader.json RPC_URL=https://api.devnet.solana.com npx tsx src/clmm/week13-trader-swaps.ts
ACTION=collect KEYPAIR=~/.config/solana/id.json RPC_URL=https://api.devnet.solana.com npx tsx src/clmm/week13-manage-position.ts
ACTION=close   KEYPAIR=~/.config/solana/id.json RPC_URL=https://api.devnet.solana.com npx tsx src/clmm/week13-manage-position.ts
```

## Упрощения учебной версии

- Пока средства лежат в позиции, пользователи не могут их вывести: перед выводом админ закрывает позицию и меняет TKB обратно в TKA (`swap` из недели 12).
- `total_tokens` учитывает только первый токен (TKA), стоимость позиции и TKB в нём не отражены.
- Rent за NFT и `personal_position` после закрытия остаётся на PDA `vault_state`.

## Проверьте себя

**Почему соотношение двух токенов в позиции зависит от того, где текущая цена внутри диапазона?**
В CLMM ликвидность L распределена по диапазону [Pa, Pb]. Количество токенов в позиции: token0 = L·(1/√P − 1/√Pb), token1 = L·(√P − √Pa). При движении цены пул продаёт из позиции дорожающий токен и получает дешевеющий. У нижней границы позиция почти целиком в одном токене, у верхней — в другом, в середине — примерно поровну по стоимости. Это видно по нашим открытиям: у позиции 1 цена была около середины, и стоимость разделилась примерно 50/50 (97,28 TKB и 0,93 TKA ≈ 92 TKB).

**Что будет с позицией, если цена уйдёт выше верхней границы?**
Позиция по пути продаст весь TKA и останется целиком в TKB (позиция 2 при закрытии вернула 0 TKA и 194,09 TKB). Она перестаёт участвовать в обменах и не зарабатывает комиссий, пока цена не вернётся в диапазон.

**Зачем нужна ребалансировка и кто её делает?**
Чтобы ликвидность снова стояла вокруг текущей цены и зарабатывала комиссии. Здесь её делает администратор vault: `collect_fees` → `close_raydium_position` → (при необходимости `swap`) → `open_raydium_position` с новым диапазоном. В настоящих продуктах это делает автоматическая стратегия (keeper/бот) по правилам: например, когда цена вышла из диапазона или приблизилась к границе.