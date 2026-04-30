import { View, Text, StyleSheet } from 'react-native'
import { Link, router } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { theme } from '@/lib/theme'
import { useState } from 'react'

export default function Signup() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')

  const handleSignup = async () => {
    // PHASE 3: Cognito signup + email verification
    router.replace('/(auth)/login')
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Create account</Text>

        <Input placeholder="Display name" value={displayName} onChangeText={setDisplayName} />
        <Input
          placeholder="Email"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
        />
        <Input
          placeholder="Password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />

        <Button label="Sign up" onPress={handleSignup} />

        <Link href="/(auth)/login" style={styles.link}>
          Already have an account? Sign in
        </Link>
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.bg },
  content: { flex: 1, padding: 24, justifyContent: 'center', gap: 16 },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: theme.colors.text,
    textAlign: 'center',
    marginBottom: 24,
  },
  link: { color: theme.colors.accent, textAlign: 'center', marginTop: 16 },
})
