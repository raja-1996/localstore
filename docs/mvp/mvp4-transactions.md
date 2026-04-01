# MVP 4 — Transactions (Payments + Booking)

> Can users pay and book services inside the app?

## Depends On
- MVP 3 (chat validates demand before building payment)

## Goal
Close the loop — users discover, trust, chat, and now pay. Merchants manage orders.

## Features
1. **Advance Token Payment** — Small advance via UPI/Razorpay to confirm booking
2. **Order Management** — Merchant accepts/rejects, marks status
3. **Service Status Tracker** — Accepted → In Progress → Ready → Delivered
4. **Quick Re-order** — "Order again?" one-tap for repeat customers
5. **Cancellation/Refund Policy** — Displayed upfront on service cards

## Validates
- Will users pay in-app vs. paying offline?
- Does advance token reduce no-shows?
- Do merchants prefer in-app orders over WhatsApp coordination?

## Not Included
- No group orders
- No subscription/recurring orders
- No merchant payouts dashboard (manual settlement initially)
