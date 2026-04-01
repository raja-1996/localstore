# LocalStore — Tech Stack

> Extends the base template stack (Expo SDK 55 + FastAPI + Supabase). Only LocalStore-specific additions listed here. Base packages (Axios, TanStack Query, Zustand, React Navigation, Jest, etc.) are defined in the original template.

## Frontend Additions

| Category | Package | Version | Purpose | MVP |
|----------|---------|---------|---------|-----|
| Maps | `react-native-maps` | latest | Merchant map pins, service area display | 1 |
| Location | `expo-location` | SDK 55 | User GPS for "near me" feed | 1 |
| Payments | `react-native-razorpay` | latest | Razorpay UPI payment sheet | 4 |
| Push | `expo-notifications` | SDK 55 | FCM/APNs push token registration | 3 |
| Camera | `expo-camera` | SDK 55 | Merchant video intro recording | 6 |
| Video | `expo-video` | SDK 55 | Play merchant intro videos | 6 |
| Audio | `expo-audio` | SDK 55 | Voice search recording + TTS playback | 6 |
| Sharing | `expo-sharing` | SDK 55 | Share recommendation cards, profile links | 5 |
| Haptics | `expo-haptics` | SDK 55 | Feedback on order confirm, follow | 2 |
| Gradient | `expo-linear-gradient` | SDK 55 | Festival planner UI, card backgrounds | 6 |
| Date | `date-fns` | 3.x | Festival countdown, order timestamps | 4 |
| Image Picker | `expo-image-picker` | SDK 55 | Portfolio uploads (already in template) | 1 |

## Backend Additions

| Category | Package | Version | Purpose | MVP |
|----------|---------|---------|---------|-----|
| HTTP client | `httpx` | latest | Async calls to Razorpay, STT/LLM APIs | 4, 6 |
| Push server | `exponent_server_sdk` | latest | Send Expo push notifications | 3 |
| Background | FastAPI `BackgroundTasks` | built-in | Async push dispatch after chat/order | 3 |
| Webhook auth | `hmac` (stdlib) | — | Razorpay webhook signature verification | 4 |

> **Note**: PostGIS queries use raw SQL via Supabase Python SDK's `.rpc()` — no ORM/GeoAlchemy2 needed.

## Supabase Configuration (LocalStore-specific)

| Service | Configuration | MVP |
|---------|---------------|-----|
| Auth | Phone OTP enabled; SMS provider (Twilio/MSG91) configured | 1 |
| PostGIS | `CREATE EXTENSION postgis;` in migration 001 | 1 |
| pg_trgm | `CREATE EXTENSION pg_trgm;` in migration 001 | 1 |
| Realtime | Enabled on: `chat_messages`, `orders`, `posts` | 3, 4 |
| Storage | 6 buckets: merchant-avatars, portfolio-images, post-media, chat-attachments, video-intros, voice-uploads | 1+ |

## External Services

| Service | Provider | Purpose | MVP |
|---------|----------|---------|-----|
| Payments | Razorpay | UPI advance token, webhooks | 4 |
| SMS/OTP | Twilio or MSG91 | Phone OTP delivery (Supabase Auth provider) | 1 |
| Push | Expo Push Service → FCM + APNs | Message, order, post alerts | 3 |
| STT | Sarvam.ai (Indian languages) or OpenAI Whisper | Voice search transcription | 6 |
| LLM | OpenAI GPT-4o-mini or Google Gemini Flash | Intent extraction from transcript | 6 |
| TTS | Sarvam.ai or Google Cloud TTS | Read merchant cards aloud | 6 |
| Translation | Google Cloud Translate or Sarvam.ai | User↔merchant language bridge | 6 |

## Key Version Constraints (LocalStore)

- `react-native-razorpay` requires Expo config plugin (no bare workflow needed)
- `expo-camera` needs `NSCameraUsageDescription` in `app.json`
- `expo-location` needs foreground permission declared; background permission for future "nearby alert" feature
- `expo-notifications` needs `NSUserNotificationsUsageDescription` + Firebase config for Android
- Sarvam.ai: REST API — call via `httpx` from FastAPI, no SDK needed
- PostGIS must be enabled before first geo migration; Supabase Cloud supports it natively
