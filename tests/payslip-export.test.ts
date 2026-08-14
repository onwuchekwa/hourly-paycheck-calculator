/**
 * @vitest-environment jsdom
 */
import { describe, expect, it } from 'vitest'
import { inlineComputedStyles } from '../src/lib/payslipExport'

describe('inlineComputedStyles', () => {
  it('copies computed rgb colors onto cloned elements', () => {
    const source = document.createElement('div')
    source.style.color = 'rgb(29, 78, 216)'
    source.innerHTML = '<p>Pay slip</p>'

    const target = document.createElement('div')
    target.innerHTML = '<p>Pay slip</p>'

    inlineComputedStyles(source, target)

    expect(target.style.color).toBe('rgb(29, 78, 216)')
  })
})
