# Restaurant Chatbot Backend

An Express + MongoDB backend for a menu-driven restaurant chatbot, with a served chat UI and Paystack payment flow.

## Stack

- Node.js + Express
- MongoDB + Mongoose
- Paystack server-side initialize/verify + webhook support
- Static frontend served from `public/index.html`

## Run

1. Install dependencies:

```bash
npm install
```

2. Set environment variables in `.env`.

3. Start the server:

```bash
npm run dev
```

4. Open:

```text
http://localhost:3000
```

## Environment

- `MONGODB_URI` - MongoDB connection string
- `MONGODB_DB` - database name
- `PAYSTACK_SECRET_KEY` - Paystack test secret key
- `PAYSTACK_PUBLIC_KEY` - optional, not required for the current redirect flow
- `PAYSTACK_WEBHOOK_SECRET` - optional placeholder for future webhook signing workflows
- `APP_BASE_URL` - used for Paystack callback redirects
- `PORT` - server port

## Commands

- `1` - show menu
- `97` - current order
- `98` - order history
- `99` - checkout
- `0` - cancel order
- `schedule:2026-05-20T14:30` - schedule an order
