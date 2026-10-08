import { seedDemo } from '../src/demo/service.js'
import { closeDatabase } from '../src/storage.js'

// No dotenv import: never implicitly connect a demo seeder to a hosted database.
try {
  const result = await seedDemo()
  console.log('Demo ready: http://localhost:5191/demo')
  for (const scene of result.scenes) console.log(`${scene.name}: /quests/${scene.roomId}?tab=${scene.tab}`)
} finally { await closeDatabase() }
