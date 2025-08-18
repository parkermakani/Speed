import { useState } from 'react'
import { Demo } from './pages/Demo'
import { AdminLogin } from './pages/AdminLogin'
import { AdminDashboard } from './pages/AdminDashboard'
import App from './App'
import { Button } from './components/primitives'
import { useAuth } from './hooks/useAuth'

export function DemoApp() {
  const [currentView, setCurrentView] = useState<'app' | 'demo' | 'admin'>('app')
  const { isAuthenticated, loading } = useAuth()

  const renderAdminView = () => {
    if (loading) {
      return <div style={{ 
        minHeight: '100vh', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        background: 'var(--color-bg)',
        color: 'var(--color-text)'
      }}>Loading...</div>
    }

    if (!isAuthenticated) {
      return <AdminLogin onLoginSuccess={() => {}} />
    }

    return <AdminDashboard onStatusUpdate={() => {
      // Force refresh the main app if it's visible
      window.location.reload()
    }} />
  }

  return (
    <div>
      {/* Navigation buttons */}
      <div style={{ 
        position: 'fixed', 
        top: 'var(--space-4)', 
        right: 'var(--space-4)', 
        zIndex: 'var(--z-overlay)',
        display: 'flex',
        gap: 'var(--space-2)'
      }}>
        {currentView !== 'app' && (
          <Button variant="secondary" onClick={() => setCurrentView('app')}>
            Map
          </Button>
        )}
        {currentView !== 'demo' && (
          <Button variant="secondary" onClick={() => setCurrentView('demo')}>
            Demo
          </Button>
        )}
        {currentView !== 'admin' && (
          <Button variant="secondary" onClick={() => setCurrentView('admin')}>
            Admin
          </Button>
        )}
      </div>
      
      {/* Render current view */}
      {currentView === 'app' && <App />}
      {currentView === 'demo' && <Demo />}
      {currentView === 'admin' && renderAdminView()}
    </div>
  )
}