# utils
Utility functions and helpers.

- `format-distance.ts` — distance formatting utility
  - exports: `formatDistance(meters: number): string`
  - behavior: converts meters to km with 1 decimal place (e.g., 1250 → "1.2 km"); shows as "meters" below 1000m
