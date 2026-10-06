import 'dotenv/config'
import { app } from './app.js'
import { verifySupabaseConnection } from './supabase.js'

const PORT = Number(process.env.PORT) || 5000
verifySupabaseConnection()
  .then(() => app.listen(PORT, '0.0.0.0', () => console.log(`GoTogether API listening on port ${PORT}`)))
  .catch((error: unknown) => {
    console.error('Unable to connect to Supabase. Check backend/.env and run database/migrations/001_gotogether_core.sql.', error)
    process.exit(1)
  })
