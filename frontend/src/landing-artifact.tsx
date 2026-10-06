import { createRoot } from 'react-dom/client'
import { LandingConcept } from './pages/LandingConcept'

// The downloadable artifact stays interactive without a server. Account and
// planning links open the existing local app, where those workflows belong.
createRoot(document.getElementById('root')!).render(
  <LandingConcept appBase={window.location.protocol === 'file:' ? 'http://localhost:5173' : ''} />,
)
