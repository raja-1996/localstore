# MVP 1 — Discovery (Merchant Profiles + Browse)

> Can users find local merchants and view their services?

## Goal
A user opens the app, sees nearby merchants, browses by category, and views their profiles/services.

## Features
1. **Auth** — Phone OTP signup/login (Supabase Auth)
2. **Merchant Profile** — Name, photo, bio, location pin, category, contact info
3. **Service Catalog** — Add service: photo + price + description
4. **Work Portfolio** — Photo gallery of past work (3-10 images)
5. **Near Me Feed** — Merchants/services sorted by distance
6. **Category Browse** — Filter by Food, Tailoring, Beauty, Home Services, etc.
7. **Basic Search** — Text search by name, category, area

## Validates
- Do merchants create and maintain profiles?
- Do users open the app to discover local services?
- Is distance-based discovery useful?

## Not Included
- No chat, no ratings, no follows, no social features
- No payments
- Merchants share their profile link via WhatsApp to bring users in

## Cold-Start
- Seed 20-30 merchants manually in one neighborhood
- Each profile gets a shareable link for WhatsApp distribution
