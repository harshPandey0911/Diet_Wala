import { BrowserRouter, HashRouter } from 'react-router-dom'
import { Toaster } from 'sonner'
import { StrictMode } from 'react'
import { Provider as ReduxProvider } from 'react-redux'
import { store } from './store'
import { UserNotificationProvider } from '../modules/Food/context/UserNotificationContext'

function getRouteSignals() {
  if (typeof window === 'undefined') {
    return {
      protocol: '',
      userAgent: '',
      pathname: '',
      search: '',
      hashPath: ''
    }
  }

  return {
    protocol: String(window.location?.protocol || '').toLowerCase(),
    userAgent: String(window.navigator?.userAgent || '').toLowerCase(),
    pathname: String(window.location?.pathname || ''),
    search: String(window.location?.search || ''),
    hashPath: String(window.location?.hash || '').replace(/^#/, '')
  }
}

function isDeliveryRoute(path) {
  const normalizedPath = String(path || '').toLowerCase()
  return normalizedPath.startsWith('/food/delivery') || normalizedPath.startsWith('/delivery')
}

function shouldUseHashRouter() {
  const { protocol, userAgent, pathname, hashPath } = getRouteSignals()

  return (
    Boolean(window?.flutter_inappwebview) ||
    Boolean(window?.ReactNativeWebView) ||
    protocol === 'file:' ||
    userAgent.includes(' wv') ||
    userAgent.includes('; wv') ||
    isDeliveryRoute(pathname) ||
    isDeliveryRoute(hashPath)
  )
}

function normalizeHashEntry() {
  const { pathname, search, hashPath } = getRouteSignals()

  if (!isDeliveryRoute(pathname) || hashPath) return

  const nextHash = `#${pathname}${search}`
  const nextUrl = `${window.location.origin}${nextHash}`
  window.history.replaceState(null, '', nextUrl)
}

export function AppProviders({ children }) {
  const useHashRouter = shouldUseHashRouter()

  if (useHashRouter) {
    normalizeHashEntry()
  }

  const Router = useHashRouter ? HashRouter : BrowserRouter

  return (
    <StrictMode>
      <ReduxProvider store={store}>
        <Router>
          <UserNotificationProvider>
            {children}
            <Toaster position="top-center" richColors offset="80px" />
          </UserNotificationProvider>
        </Router>
      </ReduxProvider>
    </StrictMode>
  )
}
