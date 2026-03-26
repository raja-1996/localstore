# hooks
Custom React hooks for theme resolution and server-state management of todos.

- `use-theme.ts` — returns the active color palette based on device color scheme
  - exports: `useTheme`
  - deps: `../constants/theme`
  - gotcha: falls back to `'light'` when `useColorScheme()` returns `null` (e.g., web/simulator)

- `use-todos.ts` — TanStack Query hooks for full CRUD on todos
  - exports: `useTodos`, `useTodo`, `useCreateTodo`, `useUpdateTodo`, `useDeleteTodo`
  - deps: `../services/todos-service`, `@tanstack/react-query`
  - side-effects: API calls via `todosService`; all mutations invalidate `['todos']` query cache on success
  - gotcha: `useTodo(id)` has `enabled: !!id` — query is disabled when `id` is falsy; prevents empty-string requests
