import { createHash, randomUUID } from 'node:crypto'
import bcrypt from 'bcryptjs'
import { selectRows, insertRow, deleteRows, updateRows } from '../storage.js'

export type PublicUser = { id: string; firstName: string; lastName: string; email: string; country: string | null; createdAt: string }
type User = { id: string; first_name: string | null; last_name: string | null; email: string; country: string | null; password_hash: string; created_at: string }

const hash = (token: string) => createHash('sha256').update(token).digest('hex')
const userColumns = ['id', 'first_name', 'last_name', 'email', 'country', 'password_hash', 'created_at']

function timestamp(value: Date | string) {
  return value instanceof Date ? value.toISOString() : String(value)
}

function asUser(row: Record<string, unknown>): User {
  return {
    id: String(row.id),
    first_name: row.first_name == null ? null : String(row.first_name),
    last_name: row.last_name == null ? null : String(row.last_name),
    email: String(row.email),
    country: row.country == null ? null : String(row.country),
    password_hash: String(row.password_hash),
    created_at: timestamp(row.created_at as Date | string),
  }
}

const publicUser = (user: User): PublicUser => ({
  id: user.id,
  firstName: user.first_name ?? '',
  lastName: user.last_name ?? '',
  email: user.email,
  country: user.country,
  createdAt: user.created_at,
})

async function session(user: User) {
  const token = randomUUID() + randomUUID()
  await insertRow('user_sessions', {
    id: `session_${randomUUID()}`, user_id: user.id, token_hash: hash(token), expires_at: new Date(Date.now() + 2592000000).toISOString(),
  }, ['id'])
  return { user: publicUser(user), token }
}

export async function registerUser(input: { firstName: string; lastName: string; email: string; password: string; country?: string }) {
  const email = input.email.trim().toLowerCase()
  const existing = await selectRows('users', ['id'], [{ column: 'email', operator: 'eq', value: email }])
  if (existing.length) throw new Error('An account with this email already exists.')

  const id = `user_${randomUUID()}`
  const passwordHash = await bcrypt.hash(input.password, 12)
  const country = input.country?.trim() || null
  const row = await insertRow('users', {
      id, first_name: input.firstName.trim(), last_name: input.lastName.trim(), email, country, password_hash: passwordHash,
      data: {
        name: `${input.firstName} ${input.lastName}`,
        email,
        firstName: input.firstName,
        lastName: input.lastName,
        country,
      },
  }, userColumns)
  return session(asUser(row))
}

export async function loginUser(email: string, password: string) {
  const rows = await selectRows('users', userColumns, [{ column: 'email', operator: 'eq', value: email.trim().toLowerCase() }])
  const user = rows[0] ? asUser(rows[0]) : undefined
  if (!user || !(await bcrypt.compare(password, user.password_hash))) throw new Error('Email or password is incorrect.')
  return session(user)
}

export async function userForToken(token: string) {
  const sessions = await selectRows<{ user_id: string }>('user_sessions', ['user_id'], [
    { column: 'token_hash', operator: 'eq', value: hash(token) },
    { column: 'expires_at', operator: 'gt', value: new Date().toISOString() },
  ])
  const current = sessions[0]
  if (!current) return undefined

  const rows = await selectRows('users', userColumns, [{ column: 'id', operator: 'eq', value: current.user_id }])
  return rows[0] ? publicUser(asUser(rows[0])) : undefined
}

export async function endSession(token: string) {
  await deleteRows('user_sessions', [{ column: 'token_hash', operator: 'eq', value: hash(token) }])
}

export async function updateUserProfile(userId: string, input: { firstName: string; lastName: string; country: string }) {
  const [existing] = await selectRows<{ data: Record<string, unknown> }>('users', ['data'], [{ column: 'id', operator: 'eq', value: userId }])
  if (!existing) throw new Error('We could not find your account.')
  const rows = await updateRows('users', { first_name: input.firstName, last_name: input.lastName, country: input.country || null, data: { ...existing.data, firstName: input.firstName, lastName: input.lastName, name: `${input.firstName} ${input.lastName}`, country: input.country || null }, updated_at: new Date().toISOString() }, [{ column: 'id', operator: 'eq', value: userId }], userColumns)
  if (!rows[0]) throw new Error('We could not find your account.')
  return publicUser(asUser(rows[0]))
}
