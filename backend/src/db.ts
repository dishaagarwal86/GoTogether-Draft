import { Pool, type QueryResult, type QueryResultRow } from 'pg'
import { getDatabaseConfig } from './databaseConfig.js'

let pool: Pool | undefined

export function getPool() {
  if (!pool) {
    const config = getDatabaseConfig()
    if (config.provider !== 'postgres') throw new Error('The PostgreSQL provider is not selected.')
    pool = new Pool({ connectionString: config.connectionString, connectionTimeoutMillis: 5000 })
  }
  return pool
}

export function query<T extends QueryResultRow = QueryResultRow>(text: string, values: unknown[] = []): Promise<QueryResult<T>> {
  return getPool().query<T>(text, values)
}

export async function verifyPostgresConnection() {
  await query('select 1')
  const schema = await query(
    `select 1 from information_schema.tables where table_schema = 'public' and table_name = 'itinerary_catalogue'`,
  )
  if (schema.rowCount !== 1) {
    throw new Error('PostgreSQL is reachable, but the GoTogether schema is missing. Apply database/migrations/001_gotogether_core.sql.')
  }
}

export async function closePool() {
  if (!pool) return
  await pool.end()
  pool = undefined
}
