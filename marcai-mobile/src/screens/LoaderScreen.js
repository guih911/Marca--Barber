import React from 'react'
import { StyleSheet, View } from 'react-native'
import LogoMark from '../ui/LogoMark'
import { colors } from '../ui/theme'

/** Vetor transparente — sem PNG com fundo falso. */
export default function LoaderScreen() {
  return (
    <View style={styles.container}>
      <LogoMark size={120} />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bg,
  },
})