/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, beforeEach } from 'vitest'
import { Timestamp } from 'firebase/firestore'
import { deriveKey, encryptJson, decryptJson, setSessionKey, clearSessionKey } from '../src/lib/offline/encryptedVault'
import { withIntegrity, verifyEntryIntegrity } from '../src/lib/offline/integrity'
import type { StoredTimeEntry } from '../src/lib/offline/types'

describe('offline integrity', () => {
  beforeEach(() => {
    clearSessionKey()
    sessionStorage.clear()
  })

  it('signs and verifies a pending entry', async () => {
    const salt = crypto.getRandomValues(new Uint8Array(16))
    const key = await deriveKey('test-password', salt)
    await setSessionKey(key, 'emp1')

    const base: Omit<StoredTimeEntry, 'integrity'> = {
      id: 'emp1_2026-08-12',
      employeeId: 'emp1',
      employeeName: 'Test',
      workDate: '2026-08-12',
      status: 'draft',
      punches: [
        {
          clockIn: Timestamp.fromDate(new Date('2026-08-12T09:00:00')),
          clockOut: null,
        },
      ],
      syncStatus: 'pending',
      localUpdatedAt: new Date().toISOString(),
      localRevision: 1,
    }

    const signed = await withIntegrity(base)
    expect(await verifyEntryIntegrity(signed)).toBe(true)

    const tampered = { ...signed, employeeName: 'Hacker' }
    expect(await verifyEntryIntegrity(tampered)).toBe(false)
  })
})

describe('encrypted vault', () => {
  it('encrypts and decrypts JSON with derived key', async () => {
    const salt = crypto.getRandomValues(new Uint8Array(16))
    const key = await deriveKey('secret', salt)
    const payload = { hello: 'world' }
    const blob = await encryptJson(key, payload)
    const restored = await decryptJson<typeof payload>(key, blob)
    expect(restored).toEqual(payload)
  })
})
