import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { getDatabaseConfig } from './databaseConfig.js'

let client: SupabaseClient | undefined

export function getSupabase() {
  if (!client) {
    const config = getDatabaseConfig()
    if (config.provider !== 'supabase') throw new Error('The Supabase provider is not selected.')
    client = createClient(config.url, config.serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    })
  }
  return client
}

export async function verifySupabaseConnection() {
  const { error } = await getSupabase().from('itinerary_catalogue').select('id', { head: true }).limit(1)
  if (error) throw new Error(`Supabase schema check failed: ${error.message}`)
}
