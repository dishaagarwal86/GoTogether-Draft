import './environment.js'
import { app } from './app.js'
import { verifyDatabaseConnection } from './storage.js'
import { getDatabaseConfig } from './databaseConfig.js'

const port = Number(process.env.PORT ?? 3001)

async function start() {
  // Missing or ambiguous configuration is not a transient connection failure.
  const { provider } = getDatabaseConfig()
  for (let attempt = 1; attempt <= 30; attempt++) {
    try {
      await verifyDatabaseConnection()
      app.listen(port, '0.0.0.0', () => {
        console.log(`GoTogether API listening on http://0.0.0.0:${port} (${provider})`)
      })
      return
    } catch (error) {
      if (attempt === 30) {
        console.error(`Unable to start using ${provider}. Check database configuration and apply all database/migrations files in order.`, error)
        process.exit(1)
      }
      await new Promise((resolve) => setTimeout(resolve, 1000))
    }
  }
}

start().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : 'Invalid database configuration.')
  process.exitCode = 1
})
