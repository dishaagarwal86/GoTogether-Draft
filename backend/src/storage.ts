import { query, verifyPostgresConnection, closePool } from './db.js'
import { getDatabaseConfig } from './databaseConfig.js'
import { getSupabase, verifySupabaseConnection } from './supabase.js'

const tables = ['users', 'user_sessions', 'preferences', 'contacts', 'itineraries', 'flights', 'hotels', 'activities', 'suggested_itineraries', 'country_itineraries', 'itinerary_catalogue', 'trip_rooms', 'trip_room_people', 'trip_room_invites', 'trip_room_messages'] as const
export type Table = typeof tables[number]
export type Row = Record<string, unknown>
export type Filter = { column: string; operator: 'eq' | 'gt' | 'ilike'; value: string } | { column: string; operator: 'in'; value: string[] }
type SelectOptions = { orderBy?: string; ascending?: boolean; limit?: number }
const jsonColumns = new Set(['data', 'dates', 'location_preferences', 'mood_preferences', 'activities_must_have', 'activities_preferred', 'accommodation_preferences', 'seasons', 'moods', 'daily_plan', 'ai_context'])

const isSupabase = () => getDatabaseConfig().provider === 'supabase'

function identifier(value: string) {
  if (!/^[a-z_][a-z0-9_]*$/.test(value)) throw new Error('Invalid database identifier.')
  return `"${value}"`
}
function tableName(table: Table) {
  if (!tables.includes(table)) throw new Error('Unsupported database table.')
  return `public.${identifier(table)}`
}
function columnsSql(columns: string[]) {
  if (!columns.length) throw new Error('At least one column is required.')
  return columns.map(identifier).join(', ')
}
function whereSql(filters: Filter[], values: unknown[]) {
  return filters.length ? ` where ${filters.map((filter) => {
    if (filter.operator === 'in') {
      values.push(filter.value)
      return `${identifier(filter.column)} = any($${values.length})`
    }
    const operator = { eq: '=', gt: '>', ilike: 'ilike' }[filter.operator]
    if (!operator) throw new Error('Unsupported database filter.')
    values.push(filter.value)
    return `${identifier(filter.column)} ${operator} $${values.length}`
  }).join(' and ')}` : ''
}
function preparedValues(row: Row) {
  return Object.entries(row).map(([column, value]) => jsonColumns.has(column) && value != null ? JSON.stringify(value) : value)
}
function requireFilters(filters: Filter[]) {
  if (!filters.length) throw new Error('Database updates and deletes require a filter.')
}
function checkError(error: { message: string } | null) {
  if (error) throw new Error(error.message)
}

export async function selectRows<T extends Row>(table: Table, columns: string[], filters: Filter[] = [], options: SelectOptions = {}): Promise<T[]> {
  const name = tableName(table)
  const selection = columnsSql(columns)
  if (options.limit !== undefined && (!Number.isSafeInteger(options.limit) || options.limit < 1)) throw new Error('Invalid database limit.')
  if (options.orderBy) identifier(options.orderBy)
  if (isSupabase()) {
    let request = getSupabase().from(table).select(columns.join(','))
    for (const filter of filters) request = filter.operator === 'in' ? request.in(filter.column, filter.value) : request.filter(filter.column, filter.operator, filter.value)
    if (options.orderBy) request = request.order(options.orderBy, { ascending: options.ascending ?? false })
    if (options.limit !== undefined) request = request.limit(options.limit)
    const { data, error } = await request
    checkError(error)
    return (data ?? []) as unknown as T[]
  }
  const values: unknown[] = []
  let sql = `select ${selection} from ${name}${whereSql(filters, values)}`
  if (options.orderBy) sql += ` order by ${identifier(options.orderBy)} ${options.ascending ? 'asc' : 'desc'}`
  if (options.limit !== undefined) { values.push(options.limit); sql += ` limit $${values.length}` }
  return (await query<T>(sql, values)).rows
}

export async function insertRow<T extends Row>(table: Table, row: Row, returning: string[]): Promise<T> {
  const name = tableName(table)
  const columns = Object.keys(row)
  const fields = columnsSql(columns)
  const selection = columnsSql(returning)
  if (isSupabase()) {
    const { data, error } = await getSupabase().from(table).insert(row).select(returning.join(',')).single()
    checkError(error)
    if (!data) throw new Error('Database insert returned no record.')
    return data as unknown as T
  }
  const result = await query<T>(`insert into ${name} (${fields}) values (${columns.map((_, index) => `$${index + 1}`).join(', ')}) returning ${selection}`, preparedValues(row))
  return result.rows[0]
}

export async function updateRows<T extends Row>(table: Table, row: Row, filters: Filter[], returning: string[]): Promise<T[]> {
  requireFilters(filters)
  const name = tableName(table)
  const columns = Object.keys(row)
  columnsSql(columns)
  const selection = columnsSql(returning)
  if (isSupabase()) {
    let request = getSupabase().from(table).update(row)
    for (const filter of filters) request = filter.operator === 'in' ? request.in(filter.column, filter.value) : request.filter(filter.column, filter.operator, filter.value)
    const { data, error } = await request.select(returning.join(','))
    checkError(error)
    return (data ?? []) as unknown as T[]
  }
  const values = preparedValues(row)
  const assignments = columns.map((column, index) => `${identifier(column)} = $${index + 1}`).join(', ')
  return (await query<T>(`update ${name} set ${assignments}${whereSql(filters, values)} returning ${selection}`, values)).rows
}

export async function deleteRows(table: Table, filters: Filter[]): Promise<number> {
  requireFilters(filters)
  const name = tableName(table)
  if (isSupabase()) {
    let request = getSupabase().from(table).delete({ count: 'exact' })
    for (const filter of filters) request = filter.operator === 'in' ? request.in(filter.column, filter.value) : request.filter(filter.column, filter.operator, filter.value)
    const { count, error } = await request
    checkError(error)
    return count ?? 0
  }
  const values: unknown[] = []
  return (await query(`delete from ${name}${whereSql(filters, values)}`, values)).rowCount ?? 0
}

export async function upsertRow(table: Table, row: Row, conflictColumns: string[]) {
  const name = tableName(table)
  const columns = Object.keys(row)
  const fields = columnsSql(columns)
  const conflict = columnsSql(conflictColumns)
  if (conflictColumns.some((column) => row[column] == null)) throw new Error('Upserts require values for every conflict column.')
  if (isSupabase()) {
    const { error } = await getSupabase().from(table).upsert(row, { onConflict: conflictColumns.join(',') })
    checkError(error)
    return
  }
  const updates = columns.filter((column) => !conflictColumns.includes(column))
    .map((column) => `${identifier(column)} = excluded.${identifier(column)}`)
  const action = updates.length ? `do update set ${updates.join(', ')}` : 'do nothing'
  await query(`insert into ${name} (${fields}) values (${columns.map((_, index) => `$${index + 1}`).join(', ')}) on conflict (${conflict}) ${action}`, preparedValues(row))
}

// Seeding is intentionally insert-only: reruns do not overwrite edited trips.
export async function insertIfMissing(table: Table, row: Row) {
  const name = tableName(table)
  const columns = Object.keys(row)
  const fields = columnsSql(columns)
  if (!row.id) throw new Error('Insert-if-missing requires an id.')
  if (isSupabase()) {
    const { error } = await getSupabase().from(table).upsert(row, { onConflict: 'id', ignoreDuplicates: true })
    checkError(error)
    return
  }
  await query(`insert into ${name} (${fields}) values (${columns.map((_, index) => `$${index + 1}`).join(', ')}) on conflict (id) do nothing`, preparedValues(row))
}

export async function verifyDatabaseConnection() {
  if (isSupabase()) await verifySupabaseConnection()
  else await verifyPostgresConnection()
}

export async function closeDatabase() {
  await closePool()
}
