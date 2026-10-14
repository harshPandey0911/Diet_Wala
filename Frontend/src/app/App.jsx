import React, { useState, useEffect } from 'react'
import AppRoutes from './routes'
import PageLoader from '@/shared/components/PageLoader.jsx'

import { ThemeProvider } from '@food/context/ThemeContext'
import { cleanupExpiredScopedEntries } from '@food/utils/appStorage'

function App() {
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    cleanupExpiredScopedEntries({ storage: 'local' })
    cleanupExpiredScopedEntries({ storage: 'session' })
  }, [])

  if (isLoading) {
    return (
      <div className="fixed inset-0 z-[99999] flex flex-col items-center justify-center bg-white dark:bg-[#0a0a0a]">
        <div className="relative w-16 h-16 flex items-center justify-center">
          <div className="absolute inset-0 border-4 border-primary/10 rounded-full" />
          <div className="absolute inset-0 border-4 border-t-primary rounded-full animate-spin" />
        </div>
        <h1 className="text-2xl font-black text-primary tracking-tighter mt-6">DietVala</h1>
      </div>
    )
  }

  return (
    <ThemeProvider>
      <>
        <PageLoader />
        <AppRoutes />
      </>
    </ThemeProvider>
  )
}

export default App
