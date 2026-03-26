# components
Reusable themed UI primitives and domain-specific widgets for the app.

- `button.tsx` — pressable button with primary/danger/outline variants and loading spinner
  - exports: `Button`
  - deps: `./themed-text`, `../hooks/use-theme`, `../constants/theme`
  - types: `ButtonProps extends Omit<PressableProps, 'children'> { title: string, variant?: 'primary'|'danger'|'outline', loading?: boolean }`
  - gotcha: `disabled` is automatically set when `loading=true`; `style` is cast as `any` to accept animated styles
  - gotcha: `outline` variant has no background (`transparent`) and uses `colors.primary` for text and border color

- `input.tsx` — labelled text input with inline error display and theme-aware styling
  - exports: `Input`
  - deps: `./themed-text`, `../hooks/use-theme`, `../constants/theme`
  - types: `InputProps extends TextInputProps { label?: string, error?: string }`
  - gotcha: border turns `danger` color when `error` prop is set; container always has `marginBottom: Spacing.md`

- `themed-text.tsx` — theme-aware `<Text>` wrapper with default/secondary/title variants
  - exports: `ThemedText`
  - deps: `../hooks/use-theme`
  - types: `ThemedTextProps extends TextProps { variant?: 'default'|'secondary'|'title' }`

- `themed-view.tsx` — `<View>` that automatically applies theme background color
  - exports: `ThemedView`
  - deps: `../hooks/use-theme`

- `todo-card.tsx` — todo list item with checkbox toggle, title strikethrough on completion, and long-press delete support
  - exports: `TodoCard`
  - deps: `./themed-text`, `../hooks/use-theme`, `../constants/theme`
  - types: `TodoCardProps { title, description?, isCompleted, onPress, onToggle, onLongPress? }`
  - gotcha: checkbox is a nested `<Pressable>` inside the card `<Pressable>` — `onPress` (navigate) and `onToggle` (complete) fire independently
  - gotcha: checkbox `testID` is dynamic: `checkbox-${title.replace(/\s+/g, '-').toLowerCase()}` — must match this pattern in tests
