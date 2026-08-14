/**
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  getConnectivityMode,
  hasConfirmedConnectivityIssue,
  isStartupConnectivityPhase,
  reportConnectivityFailure,
  reportConnectivitySuccess,
  resetConnectivityStateForTests,
  setSuppressConnectivityFailures,
  subscribeConnectivityFailures,
} from '../src/lib/offline/connectivityState'

describe('connectivityState', () => {
  beforeEach(() => {
    resetConnectivityStateForTests('online')
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('starts degraded when navigator.onLine is true', () => {
    vi.stubGlobal('navigator', { onLine: true })
    resetConnectivityStateForTests()
    expect(getConnectivityMode()).toBe('degraded')
    expect(isStartupConnectivityPhase()).toBe(true)
    expect(hasConfirmedConnectivityIssue()).toBe(false)
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

  it('promotes to online after a single success during startup', () => {
    vi.stubGlobal('navigator', { onLine: true })
    resetConnectivityStateForTests('degraded')
    reportConnectivitySuccess()
    expect(getConnectivityMode()).toBe('online')
  })

  it('requires two successes to recover after a confirmed outage', () => {
    vi.stubGlobal('navigator', { onLine: true })
    resetConnectivityStateForTests('online')
    reportConnectivityFailure()
    expect(hasConfirmedConnectivityIssue()).toBe(true)
    reportConnectivitySuccess()
    expect(getConnectivityMode()).toBe('degraded')
    reportConnectivitySuccess()
    expect(getConnectivityMode()).toBe('online')
  })

  it('resets success streak on failure during recovery', () => {
    vi.stubGlobal('navigator', { onLine: true })
    resetConnectivityStateForTests('online')
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

  it('does not notify failure listeners when already degraded', () => {
    vi.stubGlobal('navigator', { onLine: true })
    resetConnectivityStateForTests('degraded')
    let calls = 0
    const unsub = subscribeConnectivityFailures(() => {
      calls += 1
    })
    reportConnectivityFailure()
    reportConnectivityFailure()
    unsub()
    expect(getConnectivityMode()).toBe('degraded')
    expect(calls).toBe(0)
  })

  it('notifies failure listeners when mode worsens from online', () => {
    vi.stubGlobal('navigator', { onLine: true })
    resetConnectivityStateForTests('online')
    let calls = 0
    const unsub = subscribeConnectivityFailures(() => {
      calls += 1
    })
    reportConnectivityFailure()
    unsub()
    expect(getConnectivityMode()).toBe('degraded')
    expect(calls).toBe(1)
  })
})
