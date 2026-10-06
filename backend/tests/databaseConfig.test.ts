import assert from 'node:assert/strict'
import { test } from 'node:test'
import { resolveDatabaseConfig } from '../src/databaseConfig.js'

test('legacy PostgreSQL-only configuration is supported', () => {
  assert.deepEqual(resolveDatabaseConfig({ DATABASE_URL: 'postgres://localhost/example' }), {
    provider: 'postgres', connectionString: 'postgres://localhost/example',
  })
})
test('legacy Supabase-only configuration is supported', () => {
  assert.deepEqual(resolveDatabaseConfig({ SUPABASE_URL: 'https://example.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'test-only' }), {
    provider: 'supabase', url: 'https://example.supabase.co', serviceRoleKey: 'test-only',
  })
})
test('an explicit provider takes precedence over unused credentials', () => {
  const both = { DATABASE_URL: 'postgres://localhost/example', SUPABASE_URL: 'https://example.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'test-only' }
  assert.equal(resolveDatabaseConfig({ ...both, DATABASE_PROVIDER: 'postgres' }).provider, 'postgres')
  assert.equal(resolveDatabaseConfig({ ...both, DATABASE_PROVIDER: 'supabase' }).provider, 'supabase')
})
test('selected provider requires only its own credentials', () => {
  assert.equal(resolveDatabaseConfig({ DATABASE_PROVIDER: 'postgres', DATABASE_URL: 'postgres://localhost/example' }).provider, 'postgres')
  assert.equal(resolveDatabaseConfig({ DATABASE_PROVIDER: 'supabase', SUPABASE_URL: 'https://example.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'test-only' }).provider, 'supabase')
  assert.throws(() => resolveDatabaseConfig({ DATABASE_PROVIDER: 'supabase', DATABASE_URL: 'postgres://localhost/example' }), /Supabase requires/)
  assert.throws(() => resolveDatabaseConfig({ DATABASE_PROVIDER: 'postgres', SUPABASE_URL: 'https://example.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'test-only' }), /PostgreSQL requires/)
})
test('ambiguous, invalid, missing, and partial settings fail without exposing secrets', () => {
  assert.throws(() => resolveDatabaseConfig({ DATABASE_URL: 'private-db-url', SUPABASE_URL: 'private-project-url' }), /Both database providers/)
  assert.throws(() => resolveDatabaseConfig({ DATABASE_PROVIDER: 'sqlite' }), /must be postgres or supabase/)
  assert.throws(() => resolveDatabaseConfig({}), /Configure DATABASE_PROVIDER/)
  assert.throws(() => resolveDatabaseConfig({ SUPABASE_URL: 'private-project-url' }), /Supabase requires/)
  assert.throws(() => resolveDatabaseConfig({ SUPABASE_SERVICE_ROLE_KEY: 'private-key' }), /Supabase requires/)
})
test('empty optional setting is treated as unset', () => {
  assert.equal(resolveDatabaseConfig({ DATABASE_PROVIDER: '', DATABASE_URL: 'postgres://localhost/example' }).provider, 'postgres')
})
