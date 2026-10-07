import { create, find, list, remove, type ApiEntity } from './apiStore.js'
import { sendGoTogetherInviteEmail } from './emailService.js'
import { HttpError } from './access.js'

export type Contact = ApiEntity & { name: string; email: string; invitedAt?: string }

const cleanEmail = (email: string) => email.trim().toLowerCase()

export async function listContacts(userId: string) {
  return (await list('contacts', 'userId', userId)) as Contact[]
}

export async function rememberContact(userId: string, input: { name?: string; email: string; invitedAt?: string }) {
  const email = cleanEmail(input.email)
  if (!email) throw new HttpError(400, 'An email address is required.')
  const existing = (await listContacts(userId)).find((contact) => cleanEmail(contact.email ?? '') === email)
  if (existing) return existing
  const name = input.name?.trim() || email.split('@')[0].replace(/[._-]+/g, ' ')
  return await create('contacts', 'contact', { userId, name, email, ...(input.invitedAt ? { invitedAt: input.invitedAt } : {}) }) as Contact
}

export async function inviteContact(userId: string, input: { name?: string; email: string }) {
  const contact = await rememberContact(userId, { ...input, invitedAt: new Date().toISOString() })
  const baseUrl = (process.env.FRONTEND_URL?.split(',')[0] || 'http://localhost:5173').replace(/\/$/, '')
  const delivery = await sendGoTogetherInviteEmail({ recipient: contact.email, name: contact.name, joinUrl: `${baseUrl}/signup` })
  return { contact, ...delivery }
}

export async function deleteContact(userId: string, contactId: string) {
  const contact = await find('contacts', contactId) as Contact | undefined
  if (!contact || contact.userId !== userId) throw new HttpError(404, 'Contact not found.')
  return remove('contacts', contactId)
}
