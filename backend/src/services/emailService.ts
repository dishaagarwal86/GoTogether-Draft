import nodemailer from 'nodemailer'

type InvitationEmail = { recipient: string; questName: string; inviteUrl: string }

export async function sendInvitationEmail({ recipient, questName, inviteUrl }: InvitationEmail) {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM } = process.env
  if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASS || !SMTP_FROM) {
    console.info(`Invitation email not sent: configure SMTP. Invite link for ${recipient}: ${inviteUrl}`)
    return { delivered: false, reason: 'SMTP is not configured' }
  }
  const transport = nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT),
    secure: process.env.SMTP_SECURE === 'true',
    auth: { user: SMTP_USER, pass: SMTP_PASS },
    // Email is helpful, but must never leave the quest creation screen
    // loading indefinitely if an SMTP provider is slow or unreachable.
    connectionTimeout: 8_000,
    greetingTimeout: 8_000,
    socketTimeout: 8_000,
  })
  await transport.sendMail({ from: SMTP_FROM, to: recipient, subject: `You’re invited to ${questName} on Go.Together`, text: `You’ve been invited to join ${questName}. Open your invitation: ${inviteUrl}`, html: `<p>You’ve been invited to join <strong>${escapeHtml(questName)}</strong> on Go.Together.</p><p><a href="${inviteUrl}">Open your invitation</a></p><p>If you do not have an account yet, you can create one after opening the link.</p>` })
  return { delivered: true }
}

function escapeHtml(value: string) { return value.replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[character] ?? character)) }
