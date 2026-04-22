import { Platform } from 'react-native'
import * as Device from 'expo-device'
import Constants from 'expo-constants'

const DEFAULT_PATH = '/logo.svg'
const VITE_DEV_PORT = 5173

const PROD_SVG = 'https://barber.xn--marca-3sa.com/logo.svg'

/**
 * URL do `logo.svg` (mesmo do web em `/logo.svg`).
 * - Produção: `extra.logoSvgUrl` ou domínio público.
 * - Dev: Vite em `localhost:5173` (ou `EXPO_PUBLIC_LOGO_URL` / `10.0.2.2` no emulador).
 */
export function resolveLogoSvgUrl() {
  const fromEnv = process.env.EXPO_PUBLIC_LOGO_URL
  if (fromEnv) return fromEnv

  if (__DEV__) {
    const isAndroidEmu = Platform.OS === 'android' && !Device.isDevice
    const host = isAndroidEmu ? '10.0.2.2' : 'localhost'
    return `http://${host}:${VITE_DEV_PORT}${DEFAULT_PATH}`
  }

  return Constants.expoConfig?.extra?.logoSvgUrl || PROD_SVG
}
