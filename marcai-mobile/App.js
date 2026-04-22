import { NavigationContainer, DefaultTheme } from '@react-navigation/native'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { Ionicons } from '@expo/vector-icons'
import { StatusBar } from 'expo-status-bar'
import { useEffect, useState } from 'react'
import { Platform } from 'react-native'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { AuthProvider, useAuth } from './src/context/AuthContext'
import { colors } from './src/ui/theme'
import ChatScreen from './src/screens/ChatScreen'
import ClientesScreen from './src/screens/ClientesScreen'
import LoaderScreen from './src/screens/LoaderScreen'
import LoginScreen from './src/screens/LoginScreen'
import AgendaScreen from './src/screens/AgendaScreen'
import GerencialScreen from './src/screens/GerencialScreen'
import useOperationalAlerts from './src/hooks/useOperationalAlerts'

const Stack = createNativeStackNavigator()
const Tab = createBottomTabNavigator()

const navTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: colors.bg,
    card: colors.bg,
    text: colors.text,
    border: colors.border,
    primary: colors.primary,
  },
}

function Navegacao() {
  const { user, loading } = useAuth()
  const [minLoaderDone, setMinLoaderDone] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setMinLoaderDone(true), 900)
    return () => clearTimeout(t)
  }, [])

  if (loading || !minLoaderDone) {
    return <LoaderScreen />
  }

  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.bg },
      }}
    >
      {user ? (
        <Stack.Screen name="TabsApp" component={TabsApp} />
      ) : (
        <Stack.Screen name="Login" component={LoginScreen} />
      )}
    </Stack.Navigator>
  )
}

function tabOptions({ route, badges }) {
  const icons = {
    AgendaTab: 'calendar-outline',
    ChatTab: 'chatbubbles-outline',
    ClientesTab: 'people-outline',
    GerencialTab: 'stats-chart-outline',
  }

  const agendaBadge = badges?.pendingAppointments > 0 ? badges.pendingAppointments : undefined
  const chatBadge = badges?.pendingHuman > 0 ? badges.pendingHuman : undefined
  const badgeByRoute = {
    AgendaTab: agendaBadge,
    ChatTab: chatBadge,
  }

  return {
    headerShown: false,
    tabBarStyle: {
      backgroundColor: colors.bgSoft,
      borderTopColor: colors.border,
      borderTopWidth: 1,
      height: Platform.OS === 'android' ? 86 : 70,
      paddingTop: Platform.OS === 'android' ? 8 : 6,
      paddingBottom: Platform.OS === 'android' ? 18 : 10,
      marginBottom: Platform.OS === 'android' ? 8 : 0,
      shadowColor: '#000',
      shadowOpacity: 0.35,
      shadowOffset: { width: 0, height: -4 },
      shadowRadius: 16,
      elevation: 12,
    },
    tabBarActiveTintColor: colors.primary,
    tabBarInactiveTintColor: colors.textSubtle,
    tabBarHideOnKeyboard: true,
    tabBarItemStyle: {
      paddingVertical: Platform.OS === 'android' ? 2 : 0,
    },
    tabBarLabelStyle: {
      fontSize: 11,
      fontWeight: '700',
      letterSpacing: 0.2,
    },
    tabBarBadge: badgeByRoute[route.name],
    tabBarBadgeStyle: {
      backgroundColor: colors.primary,
      color: colors.white,
      fontSize: 10,
      fontWeight: '700',
    },
    tabBarIcon: ({ color, size }) => (
      <Ionicons name={icons[route.name] || 'ellipse-outline'} size={size} color={color} />
    ),
  }
}

function TabsApp() {
  const badges = useOperationalAlerts({ enabled: true })

  return (
    <Tab.Navigator screenOptions={({ route }) => tabOptions({ route, badges })}>
      <Tab.Screen name="AgendaTab" component={AgendaScreen} options={{ title: 'Agenda', tabBarLabel: 'Agenda' }} />
      <Tab.Screen name="ChatTab" component={ChatScreen} options={{ title: 'Mensagens', tabBarLabel: 'Mensagens' }} />
      <Tab.Screen name="ClientesTab" component={ClientesScreen} options={{ title: 'Clientes', tabBarLabel: 'Clientes' }} />
      <Tab.Screen name="GerencialTab" component={GerencialScreen} options={{ title: 'Resumo', tabBarLabel: 'Resumo' }} />
    </Tab.Navigator>
  )
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <NavigationContainer theme={navTheme}>
          <StatusBar style="light" />
          <Navegacao />
        </NavigationContainer>
      </AuthProvider>
    </SafeAreaProvider>
  )
}

