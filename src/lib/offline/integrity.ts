import { getSessionKey } from './encryptedVault'
import { canonicalEntryPayload } from './serialization'
import type { StoredTimeEntry } from './types'

function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  for (const b of bytes) binary += String.fromCharCode(b)
  return btoa(binary)
}

export async function signEntry(entry: StoredTimeEntry): Promise<string> {
  const key = await getSessionKey()
  if (!key) throw new Error('Vault is locked')
  const hmacKey = await crypto.subtle.importKey(
    'raw',
    await crypto.subtle.exportKey('raw', key),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const payload = canonicalEntryPayload({ ...entry, integrity: '' })
  const sig = await crypto.subtle.sign('HMAC', hmacKey, new TextEncoder().encode(payload))
  return bytesToBase64(new Uint8Array(sig))
}

export async function verifyEntryIntegrity(entry: StoredTimeEntry): Promise<boolean> {
  try {
    const expected = await signEntry({ ...entry, integrity: '' })
    return expected === entry.integrity
  } catch {
    return false
  }
}

export async function withIntegrity(entry: Omit<StoredTimeEntry, 'integrity'>): Promise<StoredTimeEntry> {
  const unsigned = { ...entry, integrity: '' } as StoredTimeEntry
  const integrity = await signEntry(unsigned)
  return { ...entry, integrity }
}
