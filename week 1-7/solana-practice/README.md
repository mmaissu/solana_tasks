# 🚀 Project Setup

## 1. Install dependencies

Install all required project dependencies:

```bash
npm install
```

## 2. Configure environment variables

Create a `.env` file in the root directory:

```bash
touch .env
```

Add the following configuration:

```env
SECRET_KEY=''

RECIPIENT_1=''

RECIPIENT_2=''

RECIPIENT_3=''
```

### Environment variables

* `SECRET_KEY` — приватный ключ вашего кошелька **Phantom**. Он используется приложением для выполнения транзакций от имени кошелька.
* `RECIPIENT_1` — Solana-адрес первого однокурсника.
* `RECIPIENT_2` — Solana-адрес второго однокурсника.
* `RECIPIENT_3` — Solana-адрес третьего однокурсника.

> ⚠️ **Важно:** никогда не публикуйте `SECRET_KEY`, не добавляйте `.env` в Git и не отправляйте приватный ключ другим людям. Указывайте только свой приватный ключ, а для `RECIPIENT_*` — публичные адреса кошельков получателей.

Пример:

```env
SECRET_KEY='your_phantom_private_key'

RECIPIENT_1='recipient_wallet_address_1'
RECIPIENT_2='recipient_wallet_address_2'
RECIPIENT_3='recipient_wallet_address_3'
```

## 3. Start the development server

Запустите проект в режиме разработки:

```bash
npm run dev
```

## 4. Run the mint process

Для запуска mint-процесса используйте:

```bash
npm run mint
```

## 📋 Quick Start

В итоге последовательность команд выглядит следующим образом:

```bash
npm install

touch .env

# Заполнить .env:
# SECRET_KEY — приватный ключ Phantom
# RECIPIENT_1 — адрес первого однокурсника
# RECIPIENT_2 — адрес второго однокурсника
# RECIPIENT_3 — адрес третьего однокурсника

npm run dev

npm run mint
```

После настройки `.env` проект готов к запуску.
