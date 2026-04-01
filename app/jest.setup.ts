/**
 * Global Jest setup.
 *
 * Provides safe default implementations for TanStack Query hooks so that
 * components using useQuery/useMutation/useInfiniteQuery do not throw
 * "No QueryClient set" when rendered in tests that don't provide a wrapper.
 *
 * Tests that explicitly mock their hooks (jest.mock('../hooks/...')) are
 * unaffected — those mocks run before any component renders and override
 * the hook implementations entirely.
 *
 * Tests that explicitly mock @tanstack/react-query itself also take
 * precedence over this setup.
 */

// This file is loaded by Jest via setupFilesAfterEnv; it runs in the same
// VM context as all tests, so jest.mock() calls here apply globally.

jest.mock('@tanstack/react-query', () => {
  // Re-export every binding from the real module.
  const actual = jest.requireActual('@tanstack/react-query');

  // Provide no-op safe defaults for the hooks that need a QueryClient.
  return {
    ...actual,

    useQuery: (options: any) => {
      // If there's a real QueryClient in context, use the real hook.
      // Otherwise return a safe idle state.
      try {
        return actual.useQuery(options);
      } catch {
        return { data: undefined, isLoading: false, isError: false, error: null };
      }
    },

    useInfiniteQuery: (options: any) => {
      try {
        return actual.useInfiniteQuery(options);
      } catch {
        return {
          data: undefined,
          isLoading: false,
          isError: false,
          error: null,
          fetchNextPage: jest.fn(),
          hasNextPage: false,
          isFetchingNextPage: false,
        };
      }
    },

    useMutation: (options: any) => {
      try {
        return actual.useMutation(options);
      } catch {
        return {
          mutate: jest.fn(),
          mutateAsync: jest.fn(),
          isPending: false,
          isSuccess: false,
          isError: false,
          error: null,
          reset: jest.fn(),
        };
      }
    },

    useQueryClient: () => {
      try {
        return actual.useQueryClient();
      } catch {
        // Return a minimal stub so callers don't crash.
        return {
          invalidateQueries: jest.fn(),
          setQueryData: jest.fn(),
          getQueryData: jest.fn(),
          cancelQueries: jest.fn(),
        };
      }
    },
  };
});
