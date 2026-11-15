# Неделя 12: обмен (swap) через Raydium CLMM

Vault обменивает часть своих токенов через CLMM-пул из недели 11. Обмен делает инструкция `swap`: контракт вызывает программу Raydium (CPI), а подписывает обмен PDA vault. Сеть: Solana devnet.

## Что добавлено в контракт

- `init_second_storage`: админ создаёт второе хранилище vault для второго токена пула. Адрес: PDA `["vault_second", vault_state, second_mint]`, владелец счёта `vault_state`.
- `swap(amount_in, minimum_amount_out, sqrt_price_limit_x64)`: запускать может только админ (`vault_state.admin == admin`). Внутри CPI в `swap_v2` программы Raydium CLMM. Подписывает PDA `vault_state`, потому что он владелец обоих token account и плательщик в CPI.
- Защита от slippage: `minimum_amount_out` обязателен (ноль запрещён). Raydium отменяет обмен, если выход меньше минимума, плюс контракт сам проверяет полученную сумму (ошибка `SwapOutputTooLow`).
- Адрес программы CLMM проверяется в контракте (`raydium_clmm_cpi::id()`, сборка с функцией `devnet`). Аккаунты Raydium объявлены как `UncheckedAccount`, token account в `Box`, чтобы не переполнять стек.

## Адреса (Explorer, devnet)

| Что | Адрес |
|---|---|
| Программа vault | [25exdZUmhe6Xah5wxHrXf1w851F3Da36tb4W2E6fG6L4](https://explorer.solana.com/address/25exdZUmhe6Xah5wxHrXf1w851F3Da36tb4W2E6fG6L4?cluster=devnet) |
| vault_state | [AhcvxRaZ7Pbs3zZNug3FCD6wdgvD5djteBvpj5RqW43q](https://explorer.solana.com/address/AhcvxRaZ7Pbs3zZNug3FCD6wdgvD5djteBvpj5RqW43q?cluster=devnet) |
| Хранилище vault TKA | [4jfw68Db59tUdea3Vc1nTdPwMPupRFuBPz5ozq9swBGR](https://explorer.solana.com/address/4jfw68Db59tUdea3Vc1nTdPwMPupRFuBPz5ozq9swBGR?cluster=devnet) |
| Хранилище vault TKB (второе) | [6xSU2MscpcFgCoXCkPFCkv4cetumbwogmc26eAfTexp9](https://explorer.solana.com/address/6xSU2MscpcFgCoXCkPFCkv4cetumbwogmc26eAfTexp9?cluster=devnet) |
| CLMM-пул (неделя 11) | [5Bpew1UyKwP9YcZNxS4XhouCc5inW4ooF7MeCRYSZwZp](https://explorer.solana.com/address/5Bpew1UyKwP9YcZNxS4XhouCc5inW4ooF7MeCRYSZwZp?cluster=devnet) |
| Программа Raydium CLMM (devnet) | [DRayAUgENGQBKVaX8owNhgzkEDyoHTGVEGHVJT1E9pfH](https://explorer.solana.com/address/DRayAUgENGQBKVaX8owNhgzkEDyoHTGVEGHVJT1E9pfH?cluster=devnet) |

## Транзакции

Подготовка vault (токен TKA, второе хранилище под TKB, депозит 1000 TKA):

- [initialize_vault](https://explorer.solana.com/tx/5yYyAKZERh6uASiv3dow3YRR5K5G6YZtG5MA6iW5Vrxy56fMLLbqJ8pDAp7oy1R98ocsczLcWzVRK6dQXeTTxFQh?cluster=devnet)
- [init_second_storage](https://explorer.solana.com/tx/5sVEt7YVoGcBm1guddrBtTLyTYvKNnzpqTcYAMLTW71z9CUxgxz3qMNwZ36AMtNZ3QTAHFswoSv8525rDxYHNpJf?cluster=devnet)
- [create_user_card](https://explorer.solana.com/tx/N3p58H43ZC23sCzJRYvnV5GaDYdn4pcRUQb4jpbFHVpAY6t5ainRdJH1tBxFTQTyKyRDiskUtCZad1tHbN4g3Hr?cluster=devnet)
- [deposit](https://explorer.solana.com/tx/55Tg6jWvgRKjvvmVknag4YS9zoDoS2SeoaQ4XxRCkkj34duwSRPa6bxxhY3jQTBCJKiDaZTsNbAn6n8GfTxdS1gj?cluster=devnet)

Обмены:

- **Успешный обмен:** [644WsLh7...](https://explorer.solana.com/tx/644WsLh7vg1fn5dzp5xYDsB6Vm7WmwnqHfr1KXDjJZVx6EobFNMwJHi6G7hcjUdCcWXnG4GXSbrLKp22h2h3pULt?cluster=devnet)
- **Обмен, отклонённый из-за slippage:** [5nb5UDnw...](https://explorer.solana.com/tx/5nb5UDnwA6nWFc9VbG48nov9ukmA2Jh5fpv8TcVGQErConZubPEhY77M1pS8VxX2tCNTeXMiDehhBEsQWh2yexXK?cluster=devnet)

## Результат обмена

Vault отдал 1 TKA и получил 99,269912 TKB. Ожидаемую сумму посчитал SDK Raydium (симуляция) до отправки.

| | До | После |
|---|---|---|
| Цена пула (mintB за mintA) | 0.01 | 0.010096957489665756 |
| 1 TKA в TKB | 100,0000 | 99,0397 |
| vault TKA | 1000 | 999 |
| vault TKB | 0 | 99,269912 |

Цена пула изменилась примерно на 1 %. Vault продал в пул TKA, поэтому TKA стал немного дешевле: за 1 TKA теперь дают 99,04 TKB вместо 100.

## Slippage

- Ожидаемый выход по симуляции: 99,269912 TKB. Минимум для успешного обмена задан на 1 % ниже: 98,277212 TKB. Фактически получено 99,269912.
- Для отклонённого обмена минимум задан вдвое выше ожидаемого (198,539824 TKB). Пул столько отдать не мог, и Raydium отменил транзакцию с ошибкой `TooLittleOutputReceived` (код 6018: в логах `Left: 99269912`, `Right: 198539824`).
- Относительно цены 100 TKB за 1 TKA получено на 0,73 % меньше: 0,25 % это комиссия пула, остальное (около 0,48 %) price impact.

Обмен сделан на 1 TKA, потому что ликвидность пула маленькая: до верхней границы диапазона пул примет всего около 10 TKA.

## Ответы на вопросы

1. **Что такое slippage и как защищаются?** Это разница между ожидаемой ценой и ценой, по которой обмен прошёл. Пока транзакция идёт в сеть, цена в пуле может измениться. Защита: всегда указывать минимум, который готовы получить; если пул отдаёт меньше, обмен отменяется.
2. **Почему цена сдвигается сильнее, если рядом с ценой мало ликвидности?** Та же сумма обмена проходит по более широкому диапазону цен, чем когда ликвидности много. В нашем пуле 1 TKA сдвинул цену на 1 %.
3. **Почему обмен подписывает программа, а не администратор?** Токены лежат на счетах, владелец которых PDA vault_state. У PDA нет приватного ключа, подписать за него может только программа через `invoke_signed` со своими seeds. Админ лишь вправе запустить обмен, но сам двигать токены vault не может.

## Упрощения

- Учёт `total_tokens` и `total_shares` в `vault_state` ведётся только по первому токену. После обмена vault держит оба токена, и учёт не пересчитывается. Перед выводом пользователями админ должен обменять токены обратно.

## Как запускалось

Скрипты рассчитаны на репозиторий raydium-sdk-V2-demo: `config.ts` и `simple_vault.idl.json` лежат в `src/`, остальное в `src/clmm/`. Ключ кошелька не хранится в коде, путь передаётся переменной `KEYPAIR`.

```bash
anchor build && anchor deploy --provider.cluster devnet
KEYPAIR=~/.config/solana/id.json RPC_URL=https://api.devnet.solana.com npx tsx src/clmm/week12-prepare-vault.ts
KEYPAIR=~/.config/solana/id.json RPC_URL=https://api.devnet.solana.com npx tsx src/clmm/week12-swap.ts
```