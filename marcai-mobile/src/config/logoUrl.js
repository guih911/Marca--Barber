import { Platform } from 'react-native'
import * as Device from 'expo-device'

const DEFAULT_PATH = '/logo.svg'
const VITE_DEV_PORT = 5173

/**
 * URL do `logo.svg` servido pelo Vite (marcaí-web), o mesmo de `/logo.svg` na sidebar.
 * Padrão: `http://localhost:5173/logo.svg`.
 * - Emulador Android: `http://10.0.2.2:5173/logo.svg` (acesso à máquina host).
 * - Aparelho físico ou se o fetch falhar: defina `EXPO_PUBLIC_LOGO_URL` (ex. `http://192.168.x.x:5173/logo.svg`) ou use o fallback em PNG do app.
 */
export function resolveLogoSvgUrl() {
  const fromEnv = process.env.EXPO_PUBLIC_LOGO_URL
  if (fromEnv) return fromEnv

  const isAndroidEmu = Platform.OS === 'android' && !Device.isDevice
  const host = isAndroidEmu ? '10.0.2.2' : 'localhost'
  return `http://${host}:${VITE_DEV_PORT}${DEFAULT_PATH}`
}
