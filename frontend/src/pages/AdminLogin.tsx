import React, { useState } from 'react'
import { Stack, Text, Button, Input, FormField, Card } from '../components/primitives'
import { useAuth } from '../hooks/useAuth'

interface AdminLoginProps {
  onLoginSuccess: () => void
}

export function AdminLogin({ onLoginSuccess }: AdminLoginProps) {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { login } = useAuth()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!password.trim()) {
      setError('Password is required')
      return
    }

    setLoading(true)
    setError('')

    const result = await login(password)
    
    if (result.success) {
      onLoginSuccess()
    } else {
      setError(result.error || 'Login failed')
    }
    
    setLoading(false)
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 'var(--space-container)',
      background: 'var(--color-bg)'
    }}>
      <Card variant="elevated" padding="xl" style={{ width: '100%', maxWidth: '400px' }}>
        <form onSubmit={handleSubmit}>
          <Stack spacing="lg">
            <Stack spacing="sm" align="center">
              <Text as="h1" size="2xl" weight="bold" align="center">
                Admin Login
              </Text>
              <Text size="sm" color="secondary" align="center">
                Enter the admin password to access the dashboard
              </Text>
            </Stack>

            <FormField 
              label="Password"
              error={error}
              required
            >
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter admin password"
                disabled={loading}
                fullWidth
                autoFocus
              />
            </FormField>

            <Button
              type="submit"
              variant="primary"
              size="lg"
              fullWidth
              loading={loading}
              disabled={!password.trim() || loading}
            >
              Login
            </Button>

            <Text size="xs" color="muted" align="center">
              This is a secure admin area. Unauthorized access is not permitted.
            </Text>
          </Stack>
        </form>
      </Card>
    </div>
  )
}