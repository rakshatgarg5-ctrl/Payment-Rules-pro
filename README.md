# Payment Rules Pro

Shopify app that lets merchants **hide** checkout payment methods using conditional rules.

Built with Shopify Functions (`purchase.payment-customization.run`) and the React Router app template.

## Features (v1)

- **Actions:** hide payment methods
- **Conditions (AND):** country, cart total, products, customer tags
- Embedded admin UI to create and edit rules

## Database (Supabase)

This app stores Shopify OAuth sessions in Supabase PostgreSQL via Prisma.

1. In [Supabase](https://supabase.com/dashboard) → **Project Settings** → **Database**, copy:
   - **Transaction pooler** URI → `DATABASE_URL` (port `6543`, add `?pgbouncer=true`)
   - **Session pooler** or **Direct** URI → `DIRECT_URL` (port `5432`)
2. Copy `.env.example` to `.env` and paste both URLs.
3. Create tables:

```bash
npm run setup
```

This runs `prisma migrate deploy`, which creates the `Session` table required for app login/session storage.

## Setup

```bash
cd "e:\New Shopify app\payment-rules-pro"
npm install
npm run setup
shopify app config link
shopify app dev
```

Create rules from the app home, or via **Settings → Payments → Customizations**.

## Notes

- Payment methods are matched by name (partial, case-insensitive).
- Customer tag conditions do not match guest checkouts.
- US/CA non-Plus stores can only customize non-credit-card methods.
