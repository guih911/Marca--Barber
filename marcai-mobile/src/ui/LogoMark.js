import React, { useMemo } from 'react'
import { Image, View } from 'react-native'
import { SvgUri } from 'react-native-svg'
import { resolveLogoSvgUrl } from '../config/logoUrl'

const localPng = require('../../assets/logo-sidebar.png')

/**
 * Mesmo `logo.svg` do web (sidebar) — carregado de `http://localhost:5173/logo.svg` em dev
 * (Vite; ver `src/config/logoUrl.js`). Reextrair PNG: `node scripts/extract-logo-png.cjs`.
 */
export default function LogoMark({ size = 80, accessibilityLabel = 'Marcaí' }) {
  const uri = useMemo(() => resolveLogoSvgUrl(), [])

  const fallback = (
    <Image accessible={false} source={localPng} style={{ width: size, height: size }} resizeMode="contain" />
  )

  return (
    <View
      style={{ width: size, height: size, justifyContent: 'center', alignItems: 'center' }}
      accessible
      accessibilityLabel={accessibilityLabel}
    >
      <SvgUri width={size} height={size} uri={uri} fallback={fallback} onError={() => {}} />
    </View>
  )
}
