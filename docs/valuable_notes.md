# Valuable Notes

## Android Release Build Blocks HTTP (Cleartext) Traffic

**Date:** 2026-03-22

**Problem:** Maestro e2e login test failed with "Invalid credentials" even though the user existed and credentials were correct via curl.

**Root Cause:**
- The app was installed as a **release build** on the Android emulator
- Android SDK 28+ blocks cleartext HTTP traffic by default in release builds
- The app's API calls to `http://10.0.2.2:8000` were silently blocked — no error in logcat, no request reached the backend
- The catch block in `login.tsx` showed "Invalid credentials" as a misleading fallback (since `error.response` was undefined on network failure)

**How to Diagnose:**
1. Check backend logs — if no request arrives, it's a network/connectivity issue, not an auth issue
2. Check if app is debug or release: `adb shell pm dump <package> | grep flags` — look for `DEBUGGABLE`
3. Debug builds have `usesCleartextTraffic="true"` in merged manifest; release builds do not

**Fix:**
- Reinstall as debug build: `npx expo run:android --variant debug`
- Or add `usesCleartextTraffic` permanently via `app.json`:
  ```json
  "android": {
    "usesCleartextTraffic": true
  }
  ```

**Key Takeaway:** When an Android app silently fails API calls with no logcat errors and no backend requests, check cleartext traffic permissions first.

---

## Maestro + Expo Dev Client: Two Gotchas

**Date:** 2026-03-22

### 1. `clearState: true` breaks the dev client connection

**Problem:** `launchApp: clearState: true` caused the dev client (`com.template.reactnative`) to show the development server picker screen instead of the app.

**Root Cause:**
- The Expo dev client stores the server URL in app data
- `clearState: true` wipes all app data, including the saved server connection
- On relaunch, the dev client has no server URL → shows the picker UI

**Fix:** Use `launchApp: {}` (no clearState). The server connection persists across runs.

**When you DO need a fresh state:** Log out via the Settings screen in a preceding flow step, or run the logout flow before signup.

### 2. `hideKeyboard` on Android triggers back navigation

**Problem:** After filling all signup form inputs and calling `hideKeyboard`, Maestro navigated back to the Login screen. The `signup-button` element was then not found.

**Root Cause:**
- On Android, `hideKeyboard` in Maestro presses the system back button on the soft keyboard
- If the keyboard is open on a stack-navigated screen, the back press closes the keyboard AND navigates back

**Fix:** Remove the `hideKeyboard` step. Tapping a button works fine with the keyboard still visible — the button tap dismisses the keyboard naturally.

**Key Takeaway:** On Android Maestro flows, avoid `hideKeyboard` on stack-navigated screens. Tap the action button directly instead.
