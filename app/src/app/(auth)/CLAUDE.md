# (auth)
Unauthenticated route group — Stack navigator with email login, signup, and phone OTP login screens.

- `_layout.tsx` — Stack navigator with `headerShown: false`; wraps all auth screens
  - exports: default `AuthLayout`
  - deps: `expo-router`

- `login.tsx` — email/password login screen with inline validation; links to signup and phone-login
  - exports: default `LoginScreen`
  - deps: `../../components/*`, `../../stores/auth-store`, `../../hooks/use-theme`, `../../constants/theme`, `expo-router`
  - side-effects: calls `useAuthStore.login(email, password)` → POST to backend auth endpoint; redirects to `/(app)/todos` on success
  - types: inline `errors` shape `{email?: string; password?: string}`
  - gotcha: client-side validation runs before API call; password min length is 6 chars; email validated via regex
  - gotcha: `testID="login-button"` on the Sign In button (used by E2E Maestro flows)

- `signup.tsx` — email/password account creation with confirm-password field
  - exports: default `SignupScreen`
  - deps: `../../components/*`, `../../stores/auth-store`, `../../hooks/use-theme`, `../../constants/theme`, `expo-router`
  - side-effects: calls `useAuthStore.signup(email, password)` → POST to backend register endpoint; redirects to `/(app)/todos` on success
  - types: inline `errors` shape `{email?: string; password?: string; confirm?: string}`
  - gotcha: `testID="signup-button"` on the Create Account button (used by E2E Maestro flows)

- `phone-login.tsx` — two-step phone OTP login: enter phone → receive SMS → enter 6-digit code
  - exports: default `PhoneLoginScreen`
  - deps: `../../components/*`, `../../stores/auth-store`, `../../hooks/use-theme`, `../../constants/theme`, `expo-router`
  - side-effects: calls `useAuthStore.sendPhoneOtp(phone)` then `useAuthStore.verifyPhoneOtp(phone, otp)`
  - types: `step` state is `'phone' | 'otp'`
  - gotcha: phone number must include country code (placeholder shows `+1234567890`); OTP must be exactly 6 digits
  - side-effects: calls `router.replace('/(app)/todos')` after successful OTP verification
  - gotcha: explicit `router.replace` is required — relying solely on `index.tsx` guard doesn't work because the user is already deep in the `(auth)` stack
