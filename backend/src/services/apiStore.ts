import { selectRows, insertRow, updateRows, deleteRows, type Filter, type Table } from '../storage.js'

export type ApiEntity = Record<string, unknown> & { id: string; createdAt: string; updatedAt: string }
export type CollectionName = 'users' | 'preferences' | 'contacts' | 'itineraries' | 'flights' | 'hotels' | 'activities' | 'suggestedItineraries'

const tables: Record<CollectionName, Table> = {
  users: 'users',
  preferences: 'preferences',
  contacts: 'contacts',
  itineraries: 'itineraries',
  flights: 'flights',
  hotels: 'hotels',
  activities: 'activities',
  suggestedItineraries: 'suggested_itineraries',
}

const preferenceFields: Record<string, string> = {
  tripRoomId: 'trip_room_id',
  dates: 'dates',
  budget: 'budget',
  peopleCount: 'people_count',
  daysCount: 'days_count',
  kidsInvolved: 'kids_involved',
  locationPreferences: 'location_preferences',
  moodPreferences: 'mood_preferences',
  activitiesMustHave: 'activities_must_have',
  activitiesPreferred: 'activities_preferred',
  accommodationPreferences: 'accommodation_preferences',
}

const entityColumns = ['id', 'data', 'created_at', 'updated_at']

type Row = { id: string; data: Record<string, unknown>; created_at: Date | string; updated_at: Date | string }

const newId = (prefix: string) => `${prefix}_${crypto.randomUUID()}`

function timestamp(value: Date | string) {
  return value instanceof Date ? value.toISOString() : String(value)
}

function entity(row: Row): ApiEntity {
  return {
    ...(row.data ?? {}),
    id: String(row.id),
    createdAt: timestamp(row.created_at),
    updatedAt: timestamp(row.updated_at),
  }
}

export async function list(collection: CollectionName, key?: string, value?: string) {
  const filters: Filter[] = []
  if (key === 'userId' && value) filters.push({ column: 'user_id', operator: 'eq', value })
  if (key === 'itineraryId' && value) filters.push({ column: 'itinerary_id', operator: 'eq', value })
  return (await selectRows<Row>(tables[collection], entityColumns, filters, { orderBy: 'created_at' })).map(entity)
}

export async function find(collection: CollectionName, entityId: string) {
  const rows = await selectRows<Row>(tables[collection], entityColumns, [{ column: 'id', operator: 'eq', value: entityId }])
  return rows[0] ? entity(rows[0]) : undefined
}

export async function create(collection: CollectionName, prefix: string, input: Record<string, unknown>) {
  const table = tables[collection]
  const row: Record<string, unknown> = { id: newId(prefix), data: input }

  if (table !== 'users') {
    row.user_id = input.userId ?? null
  }
  if (table === 'flights' || table === 'hotels' || table === 'activities') {
    row.itinerary_id = input.itineraryId ?? null
  }
  if (table === 'preferences') {
    for (const [key, column] of Object.entries(preferenceFields)) {
      if (key in input) {
        row[column] = input[key]
      }
    }
  }

  return entity(await insertRow<Row>(table, row, entityColumns))
}

export async function update(collection: CollectionName, entityId: string, input: Record<string, unknown>) {
  const existing = await find(collection, entityId)
  if (!existing) return undefined

  const { id: _id, createdAt: _createdAt, updatedAt: _updatedAt, ...data } = existing
  const row: Record<string, unknown> = { data: { ...data, ...input }, updated_at: new Date().toISOString() }

  if (collection === 'preferences') {
    for (const [key, column] of Object.entries(preferenceFields)) {
      if (key in input) {
        row[column] = input[key]
      }
    }
  }

  const rows = await updateRows<Row>(tables[collection], row, [{ column: 'id', operator: 'eq', value: entityId }], entityColumns)
  return rows[0] ? entity(rows[0]) : undefined
}

export async function remove(collection: CollectionName, entityId: string) {
  return await deleteRows(tables[collection], [{ column: 'id', operator: 'eq', value: entityId }]) === 1
}

export async function countryItineraries(country: string) {
  return selectRows<{ id: string; country: string; title: string; duration: string; budget: string }>(
    'country_itineraries', ['id', 'country', 'title', 'duration', 'budget'], [{ column: 'country', operator: 'ilike', value: country }],
  )
}
