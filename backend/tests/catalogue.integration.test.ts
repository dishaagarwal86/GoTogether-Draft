import assert from 'node:assert/strict'
import { test } from 'node:test'
import { selectRows, closeDatabase } from '../src/storage.js'

test('running the full seed twice creates exactly 72 catalogue entries', async () => {
  assert.equal(process.env.NODE_ENV, 'test')
  assert.equal(process.env.DATABASE_URL, 'postgres://provider_test:provider_test@127.0.0.1:55436/gotogether_provider_test')
  try {
    const rows = await selectRows('itinerary_catalogue', ['id', 'daily_plan', 'moods', 'seasons'])
    assert.equal(rows.length, 72)
    assert.equal(new Set(rows.map((row) => row.id)).size, 72)
    assert.ok(rows.every((row) => Array.isArray(row.daily_plan) && Array.isArray(row.moods) && Array.isArray(row.seasons)))
  } finally { await closeDatabase() }
})
