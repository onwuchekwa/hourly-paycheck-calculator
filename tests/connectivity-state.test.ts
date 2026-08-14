/**
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  getConnectivityMode,
  reportConnectivityFailure,
  reportConnectivitySuccess,
  resetConnectivityStateForTests,
} from '../src/lib/offline/connectivityState'

describe('connectivityState', () => {
  beforeEach(() => {
    resetConnectivityStateForTests('online')
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('sets degraded on first failure while navigator.onLine is true', () => {
    vi.stubGlobal('navigator', { onLine: true })
    reportConnectivityFailure()
    expect(getConnectivityMode()).toBe('degraded')
  })

  it('sets offline when navigator.onLine is false', () => {
    vi.stubGlobal('navigator', { onLine: false })
    reportConnectivityFailure()
    expect(getConnectivityMode()).toBe('offline')
  })

  it('returns to online after successful probe while onLine', () => {
    vi.stubGlobal('navigator', { onLine: true })
    reportConnectivityFailure()
    reportConnectivitySuccess()
    expect(getConnectivityMode()).toBe('online')
  })
})
