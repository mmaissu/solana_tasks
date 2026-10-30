# Simple Vault — неделя 8

Учебный SPL-токен vault на Anchor 0.31.1 (Solana). Пользователи вносят токены и получают shares, у каждого пользователя есть личная карточка (`UserCard`), админ может поставить vault на паузу.

Program ID (devnet): `25exdZUmhe6Xah5wxHrXf1w851F3Da36tb4W2E6fG6L4`

---

## Инструкции

| Инструкция | Что делает |
|---|---|
| `initialize_vault` | Создаёт `VaultState` PDA, vault token account и share mint |
| `deposit(amount)` | Переводит токены в vault и минтит shares пользователю |
| `withdraw(shares)` | Сжигает shares и возвращает токены пользователю |
| `create_user_card` | Создаёт личную карточку пользователя (`UserCard`) в vault |
| `close_user_card` | Закрывает карточку, рента возвращается владельцу |
| `set_paused(paused)` | Админ включает или снимает паузу |
| `open_raydium_position`, `close_raydium_position` | Открытие и закрытие позиции в Raydium CLMM через CPI (в тестах не покрыты) |

**Формула shares:**

```
Первый депозит:       shares = amount                    (1:1)
Последующие:          shares = amount × total_shares / total_tokens
Вывод:                tokens = shares × total_tokens / total_shares
```

---

## Выполненные задания практики

| Задание | Что сделано |
|---|---|
| `created_at` | В `UserCard` добавлено поле `created_at: i64`, в `create_user_card` записывается `Clock::get()?.unix_timestamp` |
| `close_user_card` | Новая инструкция: закрывает карточку (`close = user`), рента возвращается владельцу. Чужую карточку закрыть нельзя: сиды PDA зависят от `user`, плюс проверка `owner == user` |
| Пауза vault | В `VaultState` добавлено поле `paused: bool`. `set_paused` доступна только админу (`has_one = admin`). При `paused = true` `create_user_card` падает с ошибкой `VaultPaused` |

---

## Аккаунты

### PDA и seeds

| PDA | Seeds |
|---|---|
| `vault_state` | `["vault", token_mint]` |
| `vault_token_account` | `["vault_tokens", token_mint]` |
| `share_mint` | `["share_mint", token_mint]` |
| `user_card` | `["user_card", vault_state, user]` |

У одного пользователя в одном vault может быть только одна карточка. Повторный `create_user_card` завершится ошибкой.

### UserCard

| Поле | Описание |
|---|---|
| `vault` | к какому vault относится карточка |
| `owner` | владелец карточки |
| `created_at` | время создания (unix timestamp) |
| `bump` | bump PDA |

---

## Требования

| Инструмент | Версия | Установка |
|---|---|---|
| Rust | stable | https://rustup.rs |
| Solana CLI | 1.18+ | https://docs.solana.com/cli/install-solana-cli-tools |
| Anchor CLI | 0.31.1 | `cargo install --git https://github.com/coral-xyz/anchor avm --locked && avm install 0.31.1 && avm use 0.31.1` |
| Node.js | 18+ | https://nodejs.org |
| Yarn | any | `npm i -g yarn` |

На Windows сборку удобнее запускать в WSL.

---

## Быстрый старт

```bash
# 1. Зависимости
yarn install

# 2. Сборка
anchor build

# 3. Свой Program ID (если проект новый или форк)
anchor keys sync     # обновит declare_id! в lib.rs и Anchor.toml
anchor build

# 4. Devnet и SOL
solana config set --url devnet
solana address
solana airdrop 2     # или https://faucet.solana.com
solana balance       # для деплоя нужно ~2.5 SOL

# 5. Деплой
anchor deploy --provider.cluster devnet

# 6. Тесты
yarn test
```

Файл `target/deploy/simple_vault-keypair.json` коммитить нельзя.

---

## Структура проекта

```
vault-dev/
├── Anchor.toml
├── Cargo.toml
├── package.json
├── programs/simple_vault/src/
│   ├── lib.rs                  # инструкции, аккаунты, состояние, ошибки
│   └── instructions/           # Raydium: open_position, close_position
└── tests/vault.ts              # тесты
```

---

## Тесты

Всего 12 тестов (`12 passing`).

**Vault (5):**

1. `initialize_vault`: vault создан, `total_tokens = 0`, `total_shares = 0`
2. UserA вносит 100: получает 100 shares (1:1)
3. UserB вносит 50: получает 50 shares, доли 66.7% / 33.3%
4. UserA выводит 50 shares: получает 50 токенов
5. Итог: доли A и B по 50%, on-chain баланс совпадает с состоянием vault

**UserCard и пауза (7):**

6. Карточка создаётся, `created_at > 0`
7. Вторая карточка того же пользователя: ошибка
8. Чужую карточку закрыть нельзя
9. Владелец закрывает карточку и получает ренту
10. После закрытия карточку можно создать заново
11. Не админ не может поставить паузу
12. При паузе `create_user_card` падает с `VaultPaused`, после снятия паузы работает

---

## Частые ошибки

| Ошибка | Причина | Решение |
|---|---|---|
| `insufficient funds` при деплое | мало SOL | пополни кошелёк на devnet |
| `AccountNotInitialized` в тестах | программа не задеплоена или другой ID | `anchor keys sync` → `anchor build` → `anchor deploy` |
| `already in use` при `create_user_card` | у пользователя уже есть карточка | ожидаемо, карточка одна на пользователя |
| `VaultPaused` | админ поставил vault на паузу | `set_paused(false)` от админа |
| `ZeroAmount` | передан `amount = 0` | передай сумму больше нуля |
| `SharesTooSmall` | депозит слишком мал относительно vault | увеличь сумму депозита |
| `429 Too Many Requests` в тестах | лимит публичного devnet RPC | подожди, запросы повторяются сами |
