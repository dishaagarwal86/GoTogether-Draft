import { BrowserRouter } from 'react-router-dom'
import { AppShell } from './components/AppShell'
import './App.css'
import './styles/flow.css'
import './styles/journey.css'
import './styles/quest-workspace.css'
import './styles/trip-canvas.css'
import './styles/travel-memory.css'
import './styles/group-room.css'
import './styles/typography.css'
import './styles/theme.css'
import './styles/motion.css'

function App() {
  return <BrowserRouter><AppShell /></BrowserRouter>
}

export default App
