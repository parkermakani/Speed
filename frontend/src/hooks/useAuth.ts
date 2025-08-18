import { useState, useEffect } from 'react'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'
const TOKEN_KEY = 'admin_token'

export interface AuthState {
  isAuthenticated: boolean
  token: string | null
  loading: boolean
}

export function useAuth() {
  const [authState, setAuthState] = useState<AuthState>({
    isAuthenticated: false,
    token: null,
    loading: true
  })

  useEffect(() => {
    // Check for existing token on mount
    const token = localStorage.getItem(TOKEN_KEY)
    if (token) {
      setAuthState({
        isAuthenticated: true,
        token,
        loading: false
      })
    } else {
      setAuthState(prev => ({ ...prev, loading: false }))
    }
  }, [])

  const login = async (password: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ password })
      })

      if (!response.ok) {
        const error = await response.json()
        return { success: false, error: error.detail || 'Login failed' }
      }

      const data = await response.json()
      const token = data.access_token

      localStorage.setItem(TOKEN_KEY, token)
      setAuthState({
        isAuthenticated: true,
        token,
        loading: false
      })

      return { success: true }
    } catch (error) {
      return { success: false, error: 'Network error' }
    }
  }

  const logout = async () => {
    try {
      // Call logout endpoint (optional, since we use client-side tokens)
      if (authState.token) {
        await fetch(`${API_BASE_URL}/auth/logout`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${authState.token}`
          }
        })
      }
    } catch (error) {
      // Ignore logout endpoint errors
    }

    // Clear local storage and state
    localStorage.removeItem(TOKEN_KEY)
    setAuthState({
      isAuthenticated: false,
      token: null,
      loading: false
    })
  }

  return {
    ...authState,
    login,
    logout
  }
}