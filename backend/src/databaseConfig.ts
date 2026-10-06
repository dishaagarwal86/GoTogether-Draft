export type DatabaseConfig =
  | { provider: 'postgres'; connectionString: string }
  | { provider: 'supabase'; url: string; serviceRoleKey: string }

// Keep selection separate from connecting: configuration mistakes fail before
// startup retries, and an unused provider never requires credentials.
export function resolveDatabaseConfig(env: NodeJS.ProcessEnv = process.env): DatabaseConfig {
  const requested = env.DATABASE_PROVIDER?.trim().toLowerCase() || undefined
  const connectionString = env.DATABASE_URL?.trim()
  const url = env.SUPABASE_URL?.trim()
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  if (requested && requested !== 'postgres' && requested !== 'supabase') {
    throw new Error('DATABASE_PROVIDER must be postgres or supabase.')
  }
  if (!requested && connectionString && (url || serviceRoleKey)) {
    throw new Error('Both database providers are configured. Set DATABASE_PROVIDER to postgres or supabase.')
  }
  const provider = requested ?? (connectionString ? 'postgres' : url || serviceRoleKey ? 'supabase' : undefined)
  if (provider === 'postgres') {
    if (!connectionString) throw new Error('PostgreSQL requires DATABASE_URL.')
    return { provider, connectionString }
  }
  if (provider === 'supabase') {
    if (!url || !serviceRoleKey) throw new Error('Supabase requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.')
    return { provider, url, serviceRoleKey }
  }
  throw new Error('Configure DATABASE_PROVIDER with DATABASE_URL, or SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.')
}

let config: DatabaseConfig | undefined
export function getDatabaseConfig() {
  return config ??= resolveDatabaseConfig()
}
