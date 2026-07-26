# Payment Rules Pro

Shopify app that lets merchants **hide**, **rename**, and **sort** checkout payment methods using conditional rules.

Built with Shopify Functions (`purchase.payment-customization.run`) and the React Router app template.

## Features (v1)

- **Actions:** hide, rename, sort payment methods
- **Conditions (AND):** country, cart total, products, customer tags
- Embedded admin UI to create and edit rules

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
- Wallet methods (Shop Pay, Apple Pay, Google Pay) cannot be renamed.
- Customer tag conditions do not match guest checkouts.
- US/CA non-Plus stores can only customize non-credit-card methods.
