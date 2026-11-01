# Неделя 11: свои токены и CLMM-пул Raydium (devnet)

Своя пара тестовых токенов, свой концентрированный пул Raydium CLMM и одна позиция, открытая вручную со своего кошелька. Сеть: Solana devnet.

## Адреса (Explorer, devnet)

| Что | Адрес |
|---|---|
| Токен A (TKA) | [58yZV9EGzxW1b7xBhMKC7VAMq5599VCdhMQ351eqmGyR](https://explorer.solana.com/address/58yZV9EGzxW1b7xBhMKC7VAMq5599VCdhMQ351eqmGyR?cluster=devnet) |
| Токен B (TKB) | [trXbiGdDwxDCpKotLVBns8ueu1aagEwjb17YFT3XN3e](https://explorer.solana.com/address/trXbiGdDwxDCpKotLVBns8ueu1aagEwjb17YFT3XN3e?cluster=devnet) |
| CLMM-пул | [5Bpew1UyKwP9YcZNxS4XhouCc5inW4ooF7MeCRYSZwZp](https://explorer.solana.com/address/5Bpew1UyKwP9YcZNxS4XhouCc5inW4ooF7MeCRYSZwZp?cluster=devnet) |
| Позиция (NFT) | [7YtugWYXoixxueHDXveE6Y3aq9gwz17Z4VkLPRwMCknA](https://explorer.solana.com/address/7YtugWYXoixxueHDXveE6Y3aq9gwz17Z4VkLPRwMCknA?cluster=devnet) |
| Транзакция создания пула | [3XtDyUbG...](https://explorer.solana.com/tx/3XtDyUbGonxeMMfwHBBzjT4HyqsEDsqGGDmizdVV665gTfyPUuNxiaJvbrJ9DSncx4oHFJe8p7bq6octWRidm4Fi?cluster=devnet) |
| Транзакция открытия позиции | [4dfv4Ckui...](https://explorer.solana.com/tx/4dfv4CvkuiWz7QvCsHdeiXdmQjJpNXnBfLPwgKPRcYwwvmVhAhUD1E6srQLoDDCVXYT6dt7KoB11i2McrknMesW5?cluster=devnet) |

Оба токена имеют 6 знаков после запятой, каждого выпущено по 1 000 000.

## Цена пула

Начальная цена: **1 TKA = 100 TKB**. Комиссия пула 0,25 % (шаг тика 60): в таблице Raydium это вариант «для большинства пар».

Raydium сортирует токены пула по адресу, поэтому внутри пула `mintA` это TKB, а `mintB` это TKA. Цена в пуле записана как **0.01** (TKA за один TKB). Это та же цена, только перевёрнутая.

## Выбранный диапазон

Я задала диапазон **90–110 TKB за 1 TKA**, то есть ±10 % вокруг цены 100. После выравнивания по тикам:

- тики: от -47040 до -45060;
- цена в пуле: 0.009061 – 0.011045, то есть примерно **90,5 – 110,4 TKB за 1 TKA**.

В позицию внесено около 1000 TKB и 9,92 TKA.

### Почему такой диапазон

- Концентрированная ликвидность работает и зарабатывает комиссии только пока цена внутри диапазона. Чем уже диапазон, тем больше комиссий на те же деньги.
- Слишком узкий диапазон (например, ±1 %) цена покидает при малейшем движении, и позиция перестаёт зарабатывать, пока её не передвинут.
- ±10 % это компромисс: методичка советует отступать на величину обычного колебания цены за период, примерно 5–10 %. Диапазон достаточно узкий, чтобы деньги работали эффективнее, чем в простом пуле, и достаточно широкий, чтобы цена не выходила из него от небольших колебаний.
- Если цена выйдет за границы, позиция окажется целиком в одном токене и перестанет зарабатывать. Тогда нужна ребалансировка: закрыть позицию и открыть новую вокруг новой цены.

## Как запускалось

Скрипты в `scripts/` рассчитаны на репозиторий [raydium-sdk-V2-demo](https://github.com/raydium-io/raydium-sdk-V2-demo): `config.ts` и `create-tokens.ts` лежат в `src/`, остальные в `src/clmm/`. Ключ кошелька не хранится в коде, путь к нему передаётся переменной `KEYPAIR`.

```bash
KEYPAIR=~/.config/solana/id.json RPC_URL=https://api.devnet.solana.com npx tsx src/create-tokens.ts
KEYPAIR=~/.config/solana/id.json RPC_URL=https://api.devnet.solana.com npx tsx src/clmm/week11-create-pool.ts
KEYPAIR=~/.config/solana/id.json RPC_URL=https://api.devnet.solana.com npx tsx src/clmm/week11-create-position.ts
```