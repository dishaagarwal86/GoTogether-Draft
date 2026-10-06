import { BrowserRouter } from 'react-router-dom'
import { AppShell } from './components/AppShell'
import './App.css'
import './styles/flow.css'
import './styles/journey.css'
import './styles/quest-workspace.css'

function App() {
  return <BrowserRouter><AppShell /></BrowserRouter>
}

export default App
