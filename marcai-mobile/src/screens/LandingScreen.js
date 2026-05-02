import React from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { PrimaryButton, SectionCard } from '../ui/components'
import LogoMark from '../ui/LogoMark'
import { colors } from '../ui/theme'

export default function LandingScreen({ navigation }) {
  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.container}>
        <View>
          <View style={styles.logoWrap}>
            <LogoMark size={88} />
          </View>
          <Text style={styles.badge}>Marcaí Barber V2</Text>
          <Text style={styles.title}>Gestão profissional da sua barbearia</Text>
          <Text style={styles.subtitle}>
            Controle agenda, atendimento e desempenho em um fluxo rápido e organizado.
          </Text>
        </View>

        <View style={styles.features}>
          <Feature title="Agenda inteligente" text="Visual moderno para operação do dia." />
          <Feature title="Painel administrativo" text="Indicadores e visão geral em segundos." />
          <Feature title="Fluxo simplificado" text="Acesso rápido para equipe e gestão." />
        </View>

        <PrimaryButton label="Entrar no sistema" onPress={() => navigation.navigate('Login')} />
      </View>
    </SafeAreaView>
  )
}

function Feature({ title, text }) {
  return (
    <SectionCard>
      <Text style={styles.featureTitle}>{title}</Text>
      <Text style={styles.featureText}>{text}</Text>
    </SectionCard>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#000' },
  container: {
    flex: 1,
    paddingHorizontal: 24,
    paddingVertical: 28,
    justifyContent: 'space-between',
  },
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: '#171717',
    color: '#ffffff',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 16,
  },
  logoWrap: {
    marginBottom: 16,
  },
  title: {
    fontSize: 36,
    lineHeight: 42,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: 0.4,
  },
  subtitle: {
    marginTop: 14,
    color: colors.textMuted,
    fontSize: 16,
    lineHeight: 24,
  },
  features: {
    gap: 12,
    marginTop: 22,
  },
  featureTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 6,
  },
  featureText: {
    color: colors.textMuted,
    fontSize: 14,
  },
})
