# react-native-template
Full-stack React Native (Expo) app with FastAPI + Supabase backend.

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
