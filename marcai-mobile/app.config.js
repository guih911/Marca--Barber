const PROD_BASE = 'https://barber.xn--marca-3sa.com'

/**
 * @param {import('@expo/config').ConfigContext} ctx
 * @returns {import('@expo/config').ExpoConfig}
 */
module.exports = ({ config }) => ({
  ...config,
  splash: {
    ...config.splash,
    backgroundColor: '#B8894D',
  },
  android: {
    ...config.android,
    adaptiveIcon: {
      ...config.android?.adaptiveIcon,
      backgroundColor: '#B8894D',
    },
  },
  extra: {
    ...config.extra,
    apiBase: process.env.EXPO_PUBLIC_API_URL
      ? String(process.env.EXPO_PUBLIC_API_URL).replace(/\/$/, '')
      : PROD_BASE,
    logoSvgUrl: process.env.EXPO_PUBLIC_LOGO_URL || `${PROD_BASE}/logo.svg`,
  },
})
