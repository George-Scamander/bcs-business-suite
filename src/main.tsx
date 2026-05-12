import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import '@fontsource/ibm-plex-sans/400.css'
import '@fontsource/ibm-plex-sans/500.css'
import '@fontsource/ibm-plex-sans/600.css'
import '@fontsource/ibm-plex-mono/400.css'
import 'antd/dist/reset.css'

import App from './app/App'
import { AppProviders } from './app/providers/AppProviders'
import { MobileStartupSplash } from './app/providers/MobileStartupSplash'
import './index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <MobileStartupSplash />
    <AppProviders>
      <App />
    </AppProviders>
  </StrictMode>,
)
