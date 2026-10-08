import test from 'node:test'
import assert from 'node:assert/strict'
import { demoEnabled } from '../src/demo/config.js'
const local = { LOCAL_QUEST_DEMO: 'true', NODE_ENV: 'test', DATABASE_PROVIDER: 'postgres', DATABASE_URL: 'postgres://demo:demo@127.0.0.1:55436/gotogether_provider_test' }
test('demo account switching is explicitly enabled only for the isolated local databases', () => {
  assert.equal(demoEnabled(local), true)
  assert.equal(demoEnabled({ ...local, NODE_ENV: 'production' }), false)
  assert.equal(demoEnabled({ ...local, LOCAL_QUEST_DEMO: '' }), false)
  assert.equal(demoEnabled({ ...local, DATABASE_URL: 'postgres://demo:demo@db.example.com/gotogether_provider_test' }), false)
  assert.equal(demoEnabled({ ...local, DATABASE_URL: 'postgres://demo:demo@localhost/production' }), false)
  assert.equal(demoEnabled({ ...local, DATABASE_PROVIDER: 'supabase' }), false)
  assert.equal(demoEnabled({ ...local, DATABASE_URL: 'not a connection string' }), false)
})
