# constants
Design-system tokens: colors, spacing, font sizes, and border radii.

- `theme.ts` — static design tokens for the entire app UI
  - exports: `Colors`, `Spacing`, `FontSize`, `BorderRadius`
  - types:
    - `Colors { light: ColorPalette, dark: ColorPalette }` — keys: `text, textSecondary, background, surface, border, primary, primaryText, danger, dangerText, success`
    - `Spacing { xs:4, sm:8, md:16, lg:24, xl:32, xxl:48 }`
    - `FontSize { sm:12, md:14, lg:16, xl:20, xxl:28, title:34 }`
    - `BorderRadius { sm:4, md:8, lg:12, xl:16, full:9999 }`
  - gotcha: `primary` (#0A7EA4), `danger` (#E5484D), and `success` (#30A46C) are IDENTICAL in both light and dark palettes
