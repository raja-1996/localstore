# react-native-template
Full-stack React Native (Expo) app with FastAPI + Supabase backend.

## Build & Dev Workflow (Android)
- **Never use Expo Go** — always use development builds. Expo Go (SDK 53+) dropped native modules like `expo-notifications`
- First time / native changes: `cd app && npx expo run:android` (builds native binary + installs + starts Metro)
- Daily dev: `cd app && npx expo start --dev-client` (reuses existing binary, JS-only, much faster)
- After emulator boot, always run: `adb reverse tcp:8081 tcp:8081`
- If Metro port conflict: kill stale node processes, NOT the emulator (`lsof -ti:8081` may return emulator PID)
- If module resolution errors after `npm install`: reset watchman (`watchman watch-del <project-root> && watchman watch-project <project-root>`) then `npx expo start --dev-client --clear`
- gotcha: never delete `package-lock.json` — use `npm ci` for clean installs; if lock file is out of sync, run `npm install --package-lock-only` first
- gotcha: `react-test-renderer` must be pinned to same version as `react` (currently `19.2.0`) to avoid peer dep conflicts

## For LLMs
At the start of every conversation, always read `docs/activity-log.md` first to get project context.

Every folder has a CLAUDE.md. When working in a folder:
1. Always read CLAUDE.md first
2. Do NOT open source files unless CLAUDE.md lacks the detail needed
3. When you do open a file, read only the specific file named in CLAUDE.md

```
react-native-template/
├── backend/                          ← CLAUDE.md
│   ├── app/                          ← CLAUDE.md
│   │   ├── api/                      ← CLAUDE.md
│   │   │   └── v1/                   ← CLAUDE.md
│   │   ├── core/                     ← CLAUDE.md
│   │   └── schemas/                  ← CLAUDE.md
│   └── tests/                        ← CLAUDE.md
│       └── integration/              ← CLAUDE.md
├── app/                              ← CLAUDE.md
│   └── src/                          ← CLAUDE.md
│       ├── app/                      ← CLAUDE.md
│       │   ├── (app)/                ← CLAUDE.md
│       │   └── (auth)/               ← CLAUDE.md
│       ├── components/               ← CLAUDE.md
│       ├── constants/                ← CLAUDE.md
│       ├── hooks/                    ← CLAUDE.md
│       ├── lib/                      ← CLAUDE.md
│       ├── services/                 ← CLAUDE.md
│       ├── stores/                   ← CLAUDE.md
│       └── __tests__/                ← CLAUDE.md
├── supabase/                         ← CLAUDE.md
│   └── migrations/                   ← CLAUDE.md
├── docs/                             ← CLAUDE.md
│   └── roles/                        ← CLAUDE.md
└── pre-commit-scripts/               ← CLAUDE.md
```
