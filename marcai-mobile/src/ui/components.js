import React from 'react'
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native'
import { colors, radius, spacing, typography } from './theme'

export function PrimaryButton({ label, onPress, loading = false, disabled = false }) {
  return (
    <Pressable style={[styles.primaryBtn, disabled && styles.disabled]} onPress={onPress} disabled={disabled}>
      {loading ? <ActivityIndicator color={colors.primaryText} /> : <Text style={styles.primaryBtnText}>{label}</Text>}
    </Pressable>
  )
}

export function SecondaryButton({ label, onPress, disabled = false }) {
  return (
    <Pressable style={[styles.secondaryBtn, disabled && styles.disabled]} onPress={onPress} disabled={disabled}>
      <Text style={styles.secondaryBtnText}>{label}</Text>
    </Pressable>
  )
}

export function SectionCard({ title, children }) {
  return (
    <View style={styles.sectionCard}>
      {title ? <Text style={styles.sectionTitle}>{title}</Text> : null}
      {children}
    </View>
  )
}

const styles = StyleSheet.create({
  primaryBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.xl,
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderWidth: 1,
    borderColor: colors.primaryDark,
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  primaryBtnText: {
    color: colors.primaryText,
    ...typography.body,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  secondaryBtn: {
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  secondaryBtnText: {
    color: colors.text,
    ...typography.body,
    fontWeight: '700',
  },
  disabled: {
    opacity: 0.65,
  },
  sectionCard: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.xl,
    padding: spacing.md,
  },
  sectionTitle: {
    color: colors.text,
    ...typography.body,
    fontWeight: '700',
    marginBottom: spacing.xs,
  },
})
