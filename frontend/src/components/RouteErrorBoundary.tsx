import { Component, type ReactNode } from 'react'
import { ErrorState } from './Ui'

// A failed chunk download should keep the navigation and a recovery action
// available (including when a deployment replaces assets in an open tab).
export class RouteErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  render() {
    return this.state.failed
      ? <ErrorState message="This page couldn’t load. Reload to try again; your saved plans are safe." retry={() => window.location.reload()} />
      : this.props.children
  }
}
