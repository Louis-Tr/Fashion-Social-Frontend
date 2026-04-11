export const FashionTheme = {
  colors: {
    background: '#FFFFFF',
    surface: '#F7F7F7',
    surfaceStrong: '#111111',
    textPrimary: '#111111',
    textSecondary: '#525252',
    textMuted: '#737373',
    border: '#E5E5E5',
    borderStrong: '#CFCFCF',
    inverseText: '#FFFFFF',
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
  },
  radius: {
    sm: 8,
    md: 12,
    lg: 16,
    pill: 999,
  },
  typography: {
    title: {
      fontSize: 24,
      fontWeight: '600' as const,
      letterSpacing: 0.6,
    },
    subtitle: {
      fontSize: 16,
      fontWeight: '600' as const,
      letterSpacing: 0.2,
    },
    body: {
      fontSize: 14,
    },
    meta: {
      fontSize: 12,
      letterSpacing: 0.3,
    },
  },
} as const
