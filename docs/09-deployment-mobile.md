# Mobile Deployment — App Store & Play Store

## Overview

Expo EAS (Expo Application Services) handles the entire build → sign → submit pipeline.
No Xcode or Android Studio required for builds. EAS runs builds in the cloud and submits
directly to the stores.

```
Code → EAS Build (cloud) → .ipa / .aab → EAS Submit → App Store / Play Store
                                              ↓
                                    EAS Update (OTA patches, no store review)
```

---

## Prerequisites

| Requirement | Cost | Purpose |
|-------------|------|---------|
| Expo account | Free | EAS Build & Submit access |
| Apple Developer Program | $99/year | App Store distribution + APNs |
| Google Play Console | $25 one-time | Play Store distribution |
| Firebase project | Free tier | FCM for Android push notifications |
| EAS CLI | Free | `npm install -g eas-cli` |

---

## 1. `app.json` — LocalStore Production Config

This is the complete, authoritative `app.json` for LocalStore. All permissions, plugins,
and config plugins required for the MVP 1–6 feature set are declared here.

> **G1 fix:** `NSLocationWhenInUseUsageDescription` is required by `expo-location` — omitting
> it causes App Store rejection and a runtime crash on iOS 14+.
>
> **G2 fix:** `ACCESS_FINE_LOCATION` is required for GPS-level accuracy on Android; without
> it `expo-location` silently degrades to approximate (city-block) accuracy.
>
> **G3 fix:** `expo-notifications` requires `google-services.json` to be placed in the
> project root and referenced via the plugin. Android builds will fail silently without FCM
> setup even if the JS code works in Expo Go.

```json
{
  "expo": {
    "name": "LocalStore",
    "slug": "localstore",
    "version": "1.0.0",
    "orientation": "portrait",
    "icon": "./assets/images/icon.png",
    "scheme": "localstore",
    "userInterfaceStyle": "automatic",
    "newArchEnabled": true,
    "ios": {
      "bundleIdentifier": "com.localstore.app",
      "supportsTablet": false,
      "googleServicesFile": "./GoogleService-Info.plist",
      "infoPlist": {
        "NSLocationWhenInUseUsageDescription": "LocalStore uses your location to show merchants and services near you.",
        "NSLocationAlwaysAndWhenInUseUsageDescription": "LocalStore uses your location in the background to alert you when a followed merchant is nearby.",
        "NSCameraUsageDescription": "LocalStore uses your camera to record your service intro video and take portfolio photos.",
        "NSMicrophoneUsageDescription": "LocalStore uses your microphone for video intro recording and voice search.",
        "NSUserNotificationsUsageDescription": "LocalStore sends you alerts for new messages, orders, and service updates.",
        "NSPhotoLibraryUsageDescription": "LocalStore uses your photo library to upload portfolio images and service media."
      }
    },
    "android": {
      "package": "com.localstore.app",
      "googleServicesFile": "./google-services.json",
      "adaptiveIcon": {
        "foregroundImage": "./assets/images/android-icon-foreground.png",
        "monochromeImage": "./assets/images/android-icon-monochrome.png",
        "backgroundColor": "#FFFFFF"
      },
      "permissions": [
        "android.permission.ACCESS_FINE_LOCATION",
        "android.permission.ACCESS_COARSE_LOCATION",
        "android.permission.CAMERA",
        "android.permission.RECORD_AUDIO",
        "android.permission.READ_MEDIA_IMAGES",
        "android.permission.READ_MEDIA_VIDEO",
        "android.permission.RECEIVE_BOOT_COMPLETED",
        "android.permission.VIBRATE",
        "com.google.android.c2dm.permission.RECEIVE"
      ]
    },
    "plugins": [
      "expo-router",
      "expo-secure-store",
      [
        "expo-location",
        {
          "locationAlwaysAndWhenInUsePermission": "LocalStore uses your location to show merchants near you.",
          "locationWhenInUsePermission": "LocalStore uses your location to show merchants near you.",
          "isIosBackgroundLocationEnabled": false,
          "isAndroidBackgroundLocationEnabled": false
        }
      ],
      [
        "expo-camera",
        {
          "cameraPermission": "LocalStore uses your camera to record service intro videos and take portfolio photos.",
          "microphonePermission": "LocalStore uses your microphone to record audio for service intro videos.",
          "recordAudioAndroid": true
        }
      ],
      [
        "expo-notifications",
        {
          "icon": "./assets/images/notification-icon.png",
          "color": "#FF6B35",
          "defaultChannel": "default",
          "sounds": ["./assets/sounds/notification.wav"]
        }
      ],
      [
        "expo-image-picker",
        {
          "photosPermission": "Allow LocalStore to access your photos for portfolio uploads.",
          "cameraPermission": "Allow LocalStore to access your camera for portfolio photos."
        }
      ],
      [
        "react-native-maps",
        {
          "googleMapsApiKey": "YOUR_GOOGLE_MAPS_ANDROID_API_KEY"
        }
      ],
      "react-native-razorpay",
      [
        "expo-splash-screen",
        {
          "image": "./assets/images/splash-icon.png",
          "imageWidth": 200,
          "backgroundColor": "#FFFFFF",
          "dark": {
            "image": "./assets/images/splash-icon-dark.png",
            "backgroundColor": "#1a1a2e"
          }
        }
      ]
    ],
    "extra": {
      "eas": {
        "projectId": "YOUR_EAS_PROJECT_ID"
      }
    },
    "runtimeVersion": {
      "policy": "appVersion"
    },
    "updates": {
      "url": "https://u.expo.dev/YOUR_EAS_PROJECT_ID"
    }
  }
}
```

### Key notes on `app.json`

- `scheme: "localstore"` — required for deep links (Razorpay payment callback, OTP redirect).
- `supportsTablet: false` — LocalStore is a phone-first app; tablet layout is not designed.
- `isIosBackgroundLocationEnabled: false` — foreground-only for MVP. Enable for "nearby alert" feature in a later MVP.
- `react-native-razorpay` requires the config plugin entry but takes no extra options in `app.json`. The API key is passed at runtime.
- `notification-icon.png` must be a white-on-transparent PNG at 96x96. Android ignores color icons in the status bar.

---

## 2. EAS Build Setup

### First-time setup

```bash
# Install EAS CLI globally
npm install -g eas-cli

# Log in to your Expo account
eas login

# Link the project (run from the app/ directory)
cd app
eas init

# Configure build profiles (generates eas.json)
eas build:configure

# Set up signing credentials interactively
eas credentials
```

### `eas.json`

```json
{
  "cli": {
    "version": ">= 15.0.0",
    "appVersionSource": "remote"
  },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal",
      "channel": "development",
      "ios": {
        "simulator": true
      },
      "android": {
        "buildType": "apk",
        "gradleCommand": ":app:assembleDebug"
      },
      "env": {
        "EXPO_PUBLIC_API_URL": "http://localhost:8000",
        "EXPO_PUBLIC_SUPABASE_URL": "http://127.0.0.1:54321"
      }
    },
    "preview": {
      "extends": "production",
      "distribution": "internal",
      "channel": "preview",
      "env": {
        "EXPO_PUBLIC_API_URL": "https://staging-api.localstore.in",
        "EXPO_PUBLIC_SUPABASE_URL": "https://STAGING_PROJECT.supabase.co"
      }
    },
    "production": {
      "channel": "production",
      "autoIncrement": true,
      "ios": {
        "resourceClass": "m-medium"
      },
      "android": {
        "buildType": "app-bundle"
      },
      "env": {
        "EXPO_PUBLIC_API_URL": "https://api.localstore.in",
        "EXPO_PUBLIC_SUPABASE_URL": "https://PROD_PROJECT.supabase.co"
      }
    }
  },
  "submit": {
    "production": {
      "ios": {
        "appleId": "your@apple.id",
        "ascAppId": "1234567890",
        "appleTeamId": "XXXXXXXXXX"
      },
      "android": {
        "serviceAccountKeyPath": "./google-service-account.json",
        "track": "internal"
      }
    }
  }
}
```

### Build profiles

| Profile | Purpose | Distribution | Output |
|---------|---------|-------------|--------|
| `development` | Dev client builds with debugger | Internal (direct install) | `.apk` / simulator `.app` |
| `preview` | QA and stakeholder testing | Internal (direct install) | `.ipa` + `.apk` |
| `production` | Store submission | App Store / Play Store | `.ipa` + `.aab` |

### Build commands

```bash
# Build for a single platform
eas build --platform ios --profile production
eas build --platform android --profile production

# Build both at once
eas build --platform all --profile production

# Build + submit in one step
eas build --platform all --profile production --auto-submit

# Development build (with expo-dev-client)
eas build --platform android --profile development
```

---

## 3. Push Notification Setup

LocalStore sends push notifications for: new chat messages (MVP 3), order status changes
(MVP 4), new posts from followed merchants (MVP 2).

Push delivery path:
```
FastAPI → Expo Push API → FCM (Android) → device
                        → APNs (iOS)   → device
```

### FCM Setup — Android

FCM is required for Android push notifications. Without `google-services.json` the app
builds successfully but no push notifications are delivered.

**Steps:**

1. Go to [Firebase Console](https://console.firebase.google.com) → Create project "LocalStore".
2. Add Android app with package name `com.localstore.app`.
3. Download `google-services.json` → place it in the project root (same level as `app.json`).
4. The `expo-notifications` plugin reads it automatically during the EAS build.

```
project root/
├── app.json                  ← references ./google-services.json
├── google-services.json      ← downloaded from Firebase Console
└── app/
    └── ...
```

> The `google-services.json` file contains no secrets that allow server-side access.
> It is safe to commit to version control. The FCM server key (used by FastAPI to send
> push messages) is a separate credential stored as an EAS secret — never in the repo.

**Set FCM server key as EAS secret:**

```bash
eas secret:create --scope project --name FCM_SERVER_KEY --value "your-fcm-server-key"
```

### APNs Setup — iOS

APNs (Apple Push Notification service) is required for iOS push notifications.

**Steps:**

1. In [Apple Developer Portal](https://developer.apple.com) → Certificates, Identifiers & Profiles.
2. Create an APNs key (.p8 file) — one key works for all apps in your account.
3. Note the Key ID and Team ID.
4. Upload the `.p8` file to EAS:

```bash
eas credentials --platform ios
# Choose: Add APNs key → provide Key ID, Team ID, upload .p8 file
```

5. For local testing, also add `GoogleService-Info.plist` (downloaded from Firebase for the iOS app):

```
project root/
├── app.json                      ← references ./GoogleService-Info.plist
├── GoogleService-Info.plist      ← downloaded from Firebase Console (iOS app)
├── google-services.json          ← downloaded from Firebase Console (Android app)
```

### Register push token in the app

```typescript
// src/services/pushService.ts
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';

export async function registerPushToken(): Promise<string | null> {
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') return null;

  const projectId = Constants.expoConfig?.extra?.eas?.projectId;
  const token = await Notifications.getExpoPushTokenAsync({ projectId });
  return token.data;  // "ExponentPushToken[xxxxxx]"
}
```

Send the token to FastAPI's `POST /push-token` endpoint (defined in `docs/08-api-reference.md`)
after login.

---

## 4. Razorpay Config Plugin Setup

`react-native-razorpay` requires a config plugin to link its native module. No extra
native code is needed in the bare workflow — the plugin handles it.

**Install:**

```bash
npx expo install react-native-razorpay
```

**`app.json` entry** (already shown in Section 1):

```json
"plugins": [
  "react-native-razorpay"
]
```

**Runtime usage** — pass the API key at call time, not in `app.json`:

```typescript
import RazorpayCheckout from 'react-native-razorpay';

const options = {
  key: process.env.EXPO_PUBLIC_RAZORPAY_KEY_ID,
  amount: orderAmountInPaise,
  currency: 'INR',
  name: 'LocalStore',
  description: serviceName,
  order_id: razorpayOrderId,   // from POST /orders → POST /payments/create-order
  prefill: { contact: userPhone },
  theme: { color: '#FF6B35' }
};

RazorpayCheckout.open(options)
  .then(data => {
    // data.razorpay_payment_id, data.razorpay_order_id, data.razorpay_signature
    // Call POST /payments/verify with these three fields
  })
  .catch(err => {
    // err.code 0 = user dismissed; err.code 1 = payment failed
  });
```

**Deep link scheme** — Razorpay redirects back to the app via the scheme declared in `app.json`.
`scheme: "localstore"` in `app.json` is sufficient; no extra configuration needed.

**EAS secret for Razorpay key:**

```bash
eas secret:create --scope project --name EXPO_PUBLIC_RAZORPAY_KEY_ID --value "rzp_live_xxxxxxxx"
eas secret:create --scope project --name RAZORPAY_KEY_SECRET --value "your-key-secret"
# RAZORPAY_KEY_SECRET is backend-only — never expose it in app.json or the React Native bundle
```

---

## 5. Google Maps API Key Setup (Android)

`react-native-maps` on Android requires a Google Maps API key. On iOS, Apple Maps is used
by default (no key required for basic maps).

**Steps:**

1. Go to [Google Cloud Console](https://console.cloud.google.com) → APIs & Services → Credentials.
2. Create an API key.
3. Restrict it: Application restrictions → Android apps → add `com.localstore.app`.
4. Enable: Maps SDK for Android.
5. Replace `YOUR_GOOGLE_MAPS_ANDROID_API_KEY` in the `react-native-maps` plugin entry in `app.json`.

**For production**, use EAS environment variables instead of hardcoding in `app.json`:

```javascript
// app.config.js (rename app.json to app.config.js to read env vars at build time)
export default {
  expo: {
    // ... all other config ...
    plugins: [
      [
        "react-native-maps",
        {
          "googleMapsApiKey": process.env.GOOGLE_MAPS_ANDROID_API_KEY
        }
      ]
    ]
  }
};
```

```bash
eas secret:create --scope project --name GOOGLE_MAPS_ANDROID_API_KEY --value "AIzaXXXXXX"
```

> **Note:** Google Maps for iOS (MKMapView via `react-native-maps` with Apple Maps) requires
> no API key. If you switch to Google Maps on iOS in the future, add a separate iOS Maps API
> key and the `googleMapsApiKey` under `ios` in the plugin config.

---

## 6. Asset Requirements

| Asset | Size | Format | Notes |
|-------|------|--------|-------|
| App icon | 1024×1024 | PNG | No transparency, no rounded corners |
| Adaptive icon foreground | 1024×1024 | PNG | Transparent background; content in center 66% |
| Adaptive icon monochrome | 1024×1024 | PNG | Single color; for Android 13+ themed icons |
| Splash icon | 1024×1024 | PNG | Transparent background |
| Notification icon | 96×96 | PNG | White on transparent; Android status bar |
| App Store screenshots | varies | PNG/JPEG | 6.7" (1290×2796), 6.5" (1242×2688), 12.9" iPad (optional) |
| Play Store screenshots | varies | PNG/JPEG | Phone (min 2), 7" tablet (optional), 10" tablet (optional) |
| Play Store feature graphic | 1024×500 | PNG/JPEG | Required for Play Store listing |

---

## 7. Build & Submit Commands

### iOS

```bash
# Build for App Store
eas build --platform ios --profile production

# Submit to App Store Connect (appears in TestFlight)
eas submit --platform ios --profile production

# Combined
eas build --platform ios --profile production --auto-submit
```

After EAS Submit uploads to App Store Connect:
1. Build appears in TestFlight automatically (allow 15–30 min processing).
2. Fill metadata in App Store Connect: description, screenshots, keywords, privacy policy URL.
3. Complete the App Review information questionnaire (location, payments — both apply to LocalStore).
4. Select the build and submit for App Review.
5. App Review typically takes 24–48 hours.

### Android

```bash
# Build for Play Store (.aab)
eas build --platform android --profile production

# Submit to Google Play Console
eas submit --platform android --profile production

# Combined
eas build --platform android --profile production --auto-submit
```

> **First Android upload must be manual.** Google Play Store API limitation: the very first
> release must be uploaded via the Play Console web UI. After that, EAS Submit handles all
> subsequent releases.

Play Store tracks (set via `track` in `eas.json` submit config):

| Track | Audience | Use |
|-------|----------|-----|
| `internal` | Up to 100 testers | First upload; internal QA |
| `alpha` | Closed testing group | Beta merchants + pilot users |
| `beta` | Open testing | City-wide soft launch |
| `production` | All users | Public release |

Promotion path: internal → alpha → beta → production (via Play Console, not EAS).

### Both platforms at once

```bash
eas build --platform all --profile production --auto-submit
```

---

## 8. OTA Updates (EAS Update)

Push JavaScript and asset changes without a store review. Users receive updates on the
next app launch (or on foreground after a configurable delay).

```bash
# Push update to production channel
eas update --channel production --message "Fix near me feed distance filter"

# Push to preview channel (for QA)
eas update --channel preview --message "Razorpay payment sheet redesign"
```

### Staged rollouts

```bash
# Roll out to 10% of production users first
eas update --channel production --message "v1.2.0 chat improvements" --rollout-percentage 10

# Increase to 50% after validating no regressions
eas update:rollout --channel production --percent 50

# Full rollout
eas update:rollout --channel production --percent 100
```

### When OTA is NOT sufficient

OTA updates can only change JavaScript and bundled assets. A full store build is required when:

| Change | Requires store build? |
|--------|-----------------------|
| Add a new Expo config plugin | Yes |
| Add a new native module (e.g., `expo-camera`, `expo-audio`) | Yes |
| Change `app.json` permissions or `infoPlist` entries | Yes |
| Change `google-services.json` or `GoogleService-Info.plist` | Yes |
| Fix a bug in JS/TypeScript only | No — OTA |
| Update screen text, colors, layouts | No — OTA |
| Add a new screen (no new native deps) | No — OTA |

### Runtime version strategy

```json
{
  "runtimeVersion": { "policy": "appVersion" }
}
```

- When **native code changes** → bump `version` in `app.json` → new store build.
- When **JS-only changes** → OTA update to the same runtime version.
- OTA updates are rejected by the client if the runtime version does not match, preventing
  incompatible updates from being applied to older store builds.

---

## 9. Environment Variables per Build

EAS injects environment variables at build time. All `EXPO_PUBLIC_*` variables are
bundled into the JS bundle (visible to users); non-prefixed variables are server-side only
and should not be set via EAS for frontend builds.

```bash
# Set secrets via CLI (stored encrypted in EAS, injected at build time)
eas secret:create --scope project --name EXPO_PUBLIC_API_URL --value "https://api.localstore.in" --environment production
eas secret:create --scope project --name EXPO_PUBLIC_SUPABASE_URL --value "https://xyz.supabase.co" --environment production
eas secret:create --scope project --name EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY --value "eyJ..." --environment production
eas secret:create --scope project --name EXPO_PUBLIC_RAZORPAY_KEY_ID --value "rzp_live_xxx" --environment production
eas secret:create --scope project --name GOOGLE_MAPS_ANDROID_API_KEY --value "AIzaXXX" --environment production
```

> `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` is safe to expose — it is the anon key, not the service
> role key. The service role key is backend-only and never set in EAS for frontend builds.

---

## 10. CI/CD — Automated Builds

### EAS Workflows (`.eas/workflows/build-and-submit.yml`)

```yaml
name: Build and Submit
on:
  push:
    branches: [main]

jobs:
  build-ios:
    type: build
    params:
      platform: ios
      profile: production

  build-android:
    type: build
    params:
      platform: android
      profile: production

  submit-ios:
    type: submit
    needs: [build-ios]
    params:
      platform: ios
      profile: production
      build_id: ${{ needs.build-ios.outputs.build_id }}

  submit-android:
    type: submit
    needs: [build-android]
    params:
      platform: android
      profile: production
      build_id: ${{ needs.build-android.outputs.build_id }}
```

### GitHub Actions alternative (`.github/workflows/eas-build.yml`)

```yaml
name: EAS Build
on:
  push:
    branches: [main]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - uses: expo/expo-github-action@v8
        with:
          eas-version: latest
          token: ${{ secrets.EXPO_TOKEN }}
      - run: cd app && npm ci
      - run: cd app && eas build --platform all --profile production --non-interactive --auto-submit
```

---

## 11. Pre-Submission Checklist

### iOS — App Store Connect

- [ ] App icon 1024×1024 PNG, no alpha channel, no rounded corners
- [ ] Screenshots for 6.7" (required), 6.5" (required), 12.9" iPad (optional)
- [ ] Privacy policy URL (required — LocalStore collects location + phone number)
- [ ] App description, subtitle, keywords, support URL
- [ ] Age rating questionnaire completed
- [ ] `NSLocationWhenInUseUsageDescription` present in `app.json` infoPlist
- [ ] `NSCameraUsageDescription` present (required even for MVP 1 if plugin is installed)
- [ ] `NSMicrophoneUsageDescription` present (required with expo-camera plugin)
- [ ] `NSUserNotificationsUsageDescription` present
- [ ] Bundle identifier `com.localstore.app` matches App Store Connect record
- [ ] `GoogleService-Info.plist` in project root and referenced in `app.json`
- [ ] APNs key uploaded to EAS credentials
- [ ] TestFlight build tested end-to-end (location, maps, push notifications)
- [ ] App Review information: location usage explained, payment system declared

### Android — Google Play Console

- [ ] App icon + adaptive icon (foreground, background, monochrome)
- [ ] Feature graphic 1024×500
- [ ] Screenshots for phone (min 2), 7" tablet (optional), 10" tablet (optional)
- [ ] Privacy policy URL
- [ ] Content rating questionnaire completed (IARC)
- [ ] Data safety form: location (yes, precise), phone number (yes), messages (yes)
- [ ] Target API level meets current Play Store requirements (API 34+ as of 2025)
- [ ] Package name `com.localstore.app` matches Play Console record
- [ ] `google-services.json` in project root and referenced in `app.json`
- [ ] FCM server key set as EAS secret
- [ ] Google Maps API key restricted to `com.localstore.app`
- [ ] First `.aab` uploaded manually via Play Console web UI
- [ ] Google Service Account key configured for EAS Submit (subsequent releases)
- [ ] Internal test build tested end-to-end (location, maps, push notifications)
- [ ] `ACCESS_FINE_LOCATION` declared in `app.json` android permissions

### Both stores

- [ ] Razorpay integration tested with test credentials in preview build
- [ ] OTA update URL and `runtimeVersion` policy set correctly in `app.json`
- [ ] EAS project ID in `app.json` extra.eas.projectId matches EAS dashboard
- [ ] All EAS secrets set for production environment
- [ ] `app.json` `scheme` value (`localstore`) matches Razorpay callback URL
