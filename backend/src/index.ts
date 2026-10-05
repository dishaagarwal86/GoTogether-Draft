import 'dotenv/config'
import { app } from './app.js'
import { verifySupabaseConnection } from './supabase.js'

const port = Number(process.env.PORT ?? 3001)
verifySupabaseConnection()
  .then(() => app.listen(port, () => console.log(`GoTogether API listening on http://127.0.0.1:${port}`)))
  .catch((error: unknown) => {
    console.error('Unable to connect to Supabase. Check backend/.env and run database/migrations/001_gotogether_core.sql.', error)
    process.exit(1)
  })
