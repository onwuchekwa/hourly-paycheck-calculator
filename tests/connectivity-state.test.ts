/**
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  getConnectivityMode,
  reportConnectivityFailure,
  reportConnectivitySuccess,
  resetConnectivityStateForTests,
  setSuppressConnectivityFailures,
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

  it('does not promote to online after a single success while degraded', () => {
    vi.stubGlobal('navigator', { onLine: true })
    reportConnectivityFailure()
    reportConnectivitySuccess()
    expect(getConnectivityMode()).toBe('degraded')
  })

  it('promotes to online after two consecutive successes while degraded', () => {
    vi.stubGlobal('navigator', { onLine: true })
    reportConnectivityFailure()
    reportConnectivitySuccess()
    reportConnectivitySuccess()
    expect(getConnectivityMode()).toBe('online')
  })

  it('resets success streak on failure', () => {
    vi.stubGlobal('navigator', { onLine: true })
    reportConnectivityFailure()
    reportConnectivitySuccess()
    reportConnectivityFailure()
    reportConnectivitySuccess()
    expect(getConnectivityMode()).toBe('degraded')
  })

  it('ignores failures while suppress flag is set', () => {
    vi.stubGlobal('navigator', { onLine: true })
    setSuppressConnectivityFailures(true)
    reportConnectivityFailure()
    expect(getConnectivityMode()).toBe('online')
    setSuppressConnectivityFailures(false)
  })
})
