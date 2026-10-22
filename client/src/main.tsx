import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import App from './App'
import BloxityProvider from './bloxity/BloxityProvider.jsx'
import { connect } from './net/connection'
import { getSavedName } from './net/identity'
import './index.css'

// Returning players: start matchmaking now, in parallel with React's first render.
const savedName = getSavedName()
if (savedName) void connect(savedName)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {/* Slug comes from VITE_GAME_SLUG in client/.env — see .env.example. */}
    <BloxityProvider gameSlug={import.meta.env.VITE_GAME_SLUG}>
      <App />
    </BloxityProvider>
  </StrictMode>,
)
