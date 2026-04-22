import React, { useState } from 'react'
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useAuth } from '../context/AuthContext'
import { PrimaryButton } from '../ui/components'
import { colors, radius, spacing, typography } from '../ui/theme'

export default function LoginScreen() {
  const { login } = useAuth()
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState('')
  const [enviando, setEnviando] = useState(false)

  const onSubmit = async () => {
    setErro('')
    if (!email.trim() || !senha) {
      setErro('Informe e-mail e senha.')
      return
    }
    setEnviando(true)
    try {
      await login(email.trim(), senha)
    } catch (e) {
      setErro(e.message || 'Não foi possível entrar.')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 12 : 0}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.inner}>
            <Text style={styles.title}>Marcaí Barber</Text>
            <Text style={styles.sub}>Painel premium para gestão da barbearia</Text>

            <TextInput
              style={styles.input}
              placeholder="E-mail"
              placeholderTextColor="#888"
              autoCapitalize="none"
              keyboardType="email-address"
              autoCorrect={false}
              value={email}
              onChangeText={setEmail}
              editable={!enviando}
              returnKeyType="next"
            />
            <TextInput
              style={styles.input}
              placeholder="Senha"
              placeholderTextColor="#888"
              secureTextEntry
              value={senha}
              onChangeText={setSenha}
              editable={!enviando}
              onSubmitEditing={onSubmit}
              returnKeyType="done"
            />

            {erro ? <Text style={styles.erro}>{erro}</Text> : null}

            <PrimaryButton label="Entrar" onPress={onSubmit} loading={enviando} disabled={enviando} />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  inner: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xxl,
  },
  title: {
    ...typography.h1,
    fontWeight: '700',
    color: colors.text,
    letterSpacing: 0.3,
  },
  sub: {
    fontSize: 15,
    color: colors.textMuted,
    marginBottom: spacing.xxl,
    marginTop: 4,
  },
  input: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    paddingHorizontal: 16,
    paddingVertical: 13,
    fontSize: 16,
    color: colors.text,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  erro: { color: colors.danger, marginBottom: 12, fontSize: 14 },
})
