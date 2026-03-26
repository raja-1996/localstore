# Mobile Deployment — App Store & Play Store

## Overview

Expo EAS (Expo Application Services) handles the entire build → sign → submit pipeline. No Xcode or Android Studio required for builds. EAS runs builds in the cloud and submits directly to stores.

```
Code → EAS Build (cloud) → .ipa / .aab → EAS Submit → App Store / Play Store
                                              ↓
                                    EAS Update (OTA patches, no store review)
```

## Prerequisites

| Requirement | Cost | Purpose |
|-------------|------|---------|
| Expo account | Free | EAS Build & Submit access |
| Apple Developer Program | $99/year | App Store distribution |
| Google Play Console | $25 one-time | Play Store distribution |
| EAS CLI | Free | `npm install -g eas-cli` |

## EAS Configuration

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
      }
    },
    "preview": {
      "extends": "production",
      "distribution": "internal",
      "channel": "preview"
    },
    "production": {
      "channel": "production",
      "autoIncrement": true,
      "ios": {
        "resourceClass": "m-medium"
      },
      "android": {
        "buildType": "app-bundle"
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

### Build Profiles

| Profile | Purpose | Distribution | Channel |
|---------|---------|-------------|---------|
| `development` | Dev builds with expo-dev-client | Internal (direct install) | development |
| `preview` | QA/stakeholder testing | Internal (direct install) | preview |
| `production` | Store submission | Store | production |

## `app.json` — Production Config

```json
{
  "expo": {
    "name": "YourApp",
    "slug": "your-app",
    "version": "1.0.0",
    "orientation": "portrait",
    "icon": "./assets/images/icon.png",
    "scheme": "yourapp",
    "userInterfaceStyle": "automatic",
    "newArchEnabled": true,
    "ios": {
      "bundleIdentifier": "com.yourcompany.yourapp",
      "supportsTablet": true,
      "infoPlist": {
        "NSCameraUsageDescription": "Used to take photos for messages",
        "NSPhotoLibraryUsageDescription": "Used to attach images to messages"
      }
    },
    "android": {
      "package": "com.yourcompany.yourapp",
      "adaptiveIcon": {
        "foregroundImage": "./assets/images/android-icon-foreground.png",
        "monochromeImage": "./assets/images/android-icon-monochrome.png",
        "backgroundColor": "#FFFFFF"
      },
      "permissions": [
        "android.permission.CAMERA",
        "android.permission.READ_MEDIA_IMAGES"
      ]
    },
    "plugins": [
      "expo-router",
      "expo-secure-store",
      [
        "expo-splash-screen",
        {
          "image": "./assets/images/splash-icon.png",
          "imageWidth": 200,
          "backgroundColor": "#FFFFFF",
          "dark": {
            "image": "./assets/images/splash-icon.png",
            "backgroundColor": "#1a1a2e"
          }
        }
      ],
      [
        "expo-image-picker",
        {
          "photosPermission": "Allow $(PRODUCT_NAME) to access your photos for sharing in chats"
        }
      ]
    ],
    "extra": {
      "eas": { "projectId": "your-eas-project-id" }
    },
    "runtimeVersion": {
      "policy": "appVersion"
    },
    "updates": {
      "url": "https://u.expo.dev/your-eas-project-id"
    }
  }
}
```

## Asset Requirements

| Asset | Size | Format | Notes |
|-------|------|--------|-------|
| App icon | 1024x1024 | PNG | No transparency, no rounded corners (stores add them) |
| Adaptive icon foreground | 1024x1024 | PNG | Transparent background, content in safe zone (center 66%) |
| Adaptive icon monochrome | 1024x1024 | PNG | Single color, for Android 13+ themed icons |
| Splash icon | 1024x1024 | PNG | Transparent background, `.png` only |
| App Store screenshots | varies | PNG/JPEG | 6.7" (1290x2796), 6.5" (1242x2688), 12.9" iPad |
| Play Store screenshots | varies | PNG/JPEG | Phone, 7" tablet, 10" tablet |

## Build & Submit Commands

### First-Time Setup

```bash
# Login to EAS
eas login

# Link project
eas init

# Configure builds (generates eas.json)
eas build:configure

# Set up credentials
eas credentials  # Interactive — configure signing certs & provisioning profiles
```

### iOS

```bash
# Build for App Store
eas build --platform ios --profile production

# Submit to App Store Connect (appears in TestFlight)
eas submit --platform ios --profile production

# Combined build + submit
eas build --platform ios --profile production --auto-submit
```

After EAS Submit uploads to App Store Connect:
1. Build appears in TestFlight (auto)
2. Fill metadata in App Store Connect (description, screenshots, keywords, privacy policy URL)
3. Complete the App Review questionnaire
4. Select build and submit for App Review
5. App Review takes 24-48 hours typically

### Android

```bash
# Build for Play Store (.aab)
eas build --platform android --profile production

# Submit to Google Play Console
eas submit --platform android --profile production

# Combined
eas build --platform android --profile production --auto-submit
```

**First Android upload must be manual** — Google Play Store API limitation. Upload the first `.aab` via the Play Console web UI, then EAS Submit works for subsequent releases.

Play Store tracks (set in `eas.json` submit config):
- `internal` → Internal testing (up to 100 testers)
- `alpha` → Closed testing
- `beta` → Open testing
- `production` → Public release

Promotion path: internal → alpha → beta → production (via Play Console).

### Both Platforms

```bash
eas build --platform all --profile production --auto-submit
```

## OTA Updates (EAS Update)

Push JavaScript/asset changes without store review. Users receive updates on next app launch.

```bash
# Push update to production channel
eas update --channel production --message "Fix login button alignment"

# Push to preview channel (for QA)
eas update --channel preview --message "New chat feature"
```

### Staged Rollouts

```bash
# Roll out to 5% of users first
eas update --channel production --message "v1.2.0" --rollout-percentage 5

# Increase to 100% after validating
eas update:rollout --channel production --percent 100
```

### Limitations

- OTA updates can only change JavaScript/assets — not native code
- If you add a new native module (e.g., expo-camera), you must do a full store build
- `runtimeVersion` in app.json prevents incompatible updates from being applied
- Follow App Store / Play Store guidelines on OTA content

### Runtime Version Strategy

```json
// app.json — auto-generate runtime version from app version
{
  "runtimeVersion": { "policy": "appVersion" }
}
```

When native code changes → bump `version` in app.json → new store build.
When JS-only changes → OTA update to same runtime version.

## Environment Variables per Build

EAS supports environment variables scoped to environments (development, preview, production).

```bash
# Set production env vars in EAS dashboard or CLI
eas env:create --name API_URL --value https://api.yourapp.com --environment production
eas env:create --name SUPABASE_URL --value https://xyz.supabase.co --environment production
```

These are injected at build time and available as `process.env.EXPO_PUBLIC_*` in your app.

## CI/CD — Automated Builds

### `.eas/workflows/build-and-submit.yml`

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

### GitHub Actions Alternative

```yaml
# .github/workflows/eas-build.yml
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

## Pre-Submission Checklist

### iOS

- [ ] App icon (1024x1024, no alpha channel)
- [ ] Screenshots for required device sizes
- [ ] Privacy policy URL
- [ ] App description, keywords, categories
- [ ] Age rating questionnaire
- [ ] `NSCameraUsageDescription` / `NSPhotoLibraryUsageDescription` in Info.plist
- [ ] Bundle identifier matches App Store Connect
- [ ] TestFlight build tested

### Android

- [ ] App icon + adaptive icon (foreground, background, monochrome)
- [ ] Screenshots for phone and tablet
- [ ] Privacy policy URL
- [ ] Content rating questionnaire
- [ ] Data safety form (what data you collect)
- [ ] Target API level meets Play Store requirements
- [ ] Package name matches Play Console
- [ ] First build uploaded manually via Play Console
- [ ] Google Service Account Key configured for EAS Submit
