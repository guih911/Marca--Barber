import React, { useMemo } from 'react'
import { Image, View } from 'react-native'
import { SvgUri } from 'react-native-svg'
import { resolveLogoSvgUrl } from '../config/logoUrl'
import { colors, radius } from './theme'

const localPng = require('../../assets/logo-sidebar.png')
const INSET = 0.1

/**
 * `logo.svg` do web, com placa de fundo dourada (identidade).
 * Reextrair PNG: `node scripts/extract-logo-png.cjs`.
 */
export default function LogoMark({ size = 80, accessibilityLabel = 'Marcaí' }) {
  const uri = useMemo(() => resolveLogoSvgUrl(), [])

  const inner = Math.max(8, size * (1 - INSET * 2))
  const fallback = (
    <Image
      accessible={false}
      source={localPng}
      style={{ width: inner, height: inner }}
      resizeMode="contain"
    />
  )

  return (
    <View
      style={{ width: size, height: size, justifyContent: 'center', alignItems: 'center' }}
      accessible
      accessibilityLabel={accessibilityLabel}
    >
      <View
        style={{
          width: size,
          height: size,
          backgroundColor: colors.primary,
          borderRadius: radius.lg,
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
        }}
      >
        <SvgUri
          width={inner}
          height={inner}
          uri={uri}
          fallback={fallback}
          onError={() => {}}
        />
      </View>
    </View>
  )
}
