import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'react-hot-toast'
import { CartProvider } from './store/CartContext'
import App from './App'
import './index.css'
import './i18n'
import * as Sentry from '@sentry/react'
import { initSentry } from './sentry'
import ErrorFallback from './components/ErrorFallback'

initSentry()

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 30,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Sentry.ErrorBoundary fallback={ErrorFallback} onReset={() => window.location.reload()}>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <CartProvider>
            <App />
          </CartProvider>
        <Toaster
          position="top-center"
          toastOptions={{
            duration: 3000,
            style: {
              background: '#2A2220',
              color: '#F5E6D3',
              border: '1px solid rgba(194, 59, 34, 0.25)',
              fontFamily: 'inherit',
            },
            success: { iconTheme: { primary: '#C23B22', secondary: '#F5E6D3' } },
            error: { iconTheme: { primary: '#ef4444', secondary: '#F5E6D3' } },
          }}
        />
      </BrowserRouter>
    </QueryClientProvider>
    </Sentry.ErrorBoundary>
  </React.StrictMode>
)
