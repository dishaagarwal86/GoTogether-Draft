import { resolveDatabaseConfig } from '../databaseConfig.js'
export const demoMarker = 'bangkok-showcase-v1'
export const demoRoomPrefix = 'room_demo_bangkok_'
export function demoEnabled(env: NodeJS.ProcessEnv = process.env) {
  if (env.LOCAL_QUEST_DEMO !== 'true' || env.NODE_ENV === 'production') return false
  try {
    const config = resolveDatabaseConfig(env)
    if (config.provider !== 'postgres') return false
    const url = new URL(config.connectionString)
    return ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) && ['/gotogether_provider_test', '/gotogether_demo'].includes(url.pathname)
  } catch { return false }
}
export const isDemoRoom = (roomId: string) => demoEnabled() && /^room_demo_bangkok_[a-f0-9-]{36}_(gather|compare|review|ready)$/.test(roomId)
