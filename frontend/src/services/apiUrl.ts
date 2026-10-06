const configuredBase = (import.meta.env.VITE_API_URL as string | undefined)?.trim().replace(/\/$/, '')
const base = configuredBase?.replace(/\/api$/, '')

// Local Vite continues to proxy /api. In production set VITE_API_URL to the
// Render service origin, for example https://gotogether-api.onrender.com.
export const apiUrl = (path: string) => `${base ?? ''}/api${path}`
