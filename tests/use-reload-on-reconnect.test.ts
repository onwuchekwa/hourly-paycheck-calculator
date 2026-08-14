/**
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createRoot, type Root } from 'react-dom/client'
import { act, createElement } from 'react'
import { useReloadOnConnectivityChange } from '../src/hooks/useReloadOnReconnect'
import type { ConnectivityMode } from '../src/lib/offline/types'

const RECONNECT_STABLE_MS = 3_000

function Harness({
  mode,
  ready,
  onReload,
}: {
  mode: ConnectivityMode
  ready: boolean
  onReload: () => void
}) {
  useReloadOnConnectivityChange(mode, onReload, ready)
  return null
}

describe('useReloadOnConnectivityChange', () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
    vi.useFakeTimers()
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(() => {
    act(() => {
      root.unmount()
    })
    container.remove()
    vi.useRealTimers()
  })

  it('does not call callback while ready is false', () => {
    const onReload = vi.fn()
    act(() => {
      root.render(createElement(Harness, { mode: 'degraded', ready: false, onReload }))
    })
    act(() => {
      root.render(createElement(Harness, { mode: 'online', ready: false, onReload }))
    })
    expect(onReload).not.toHaveBeenCalled()
  })

  it('baselines on ready without callback, then reloads after reconnect debounce', () => {
    const onReload = vi.fn()
    act(() => {
      root.render(createElement(Harness, { mode: 'degraded', ready: false, onReload }))
    })
    act(() => {
      root.render(createElement(Harness, { mode: 'degraded', ready: true, onReload }))
    })
    expect(onReload).not.toHaveBeenCalled()

    act(() => {
      root.render(createElement(Harness, { mode: 'online', ready: true, onReload }))
    })
    expect(onReload).not.toHaveBeenCalled()

    act(() => {
      vi.advanceTimersByTime(RECONNECT_STABLE_MS)
    })
    expect(onReload).toHaveBeenCalledTimes(1)
  })
})
