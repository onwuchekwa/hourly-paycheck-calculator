const VISUAL_STYLE_PROPS = [
  'color',
  'background-color',
  'background-image',
  'border',
  'border-color',
  'border-width',
  'border-style',
  'border-radius',
  'border-top',
  'border-right',
  'border-bottom',
  'border-left',
  'font',
  'font-size',
  'font-weight',
  'font-family',
  'line-height',
  'letter-spacing',
  'text-align',
  'text-decoration',
  'text-transform',
  'padding',
  'padding-top',
  'padding-right',
  'padding-bottom',
  'padding-left',
  'margin',
  'margin-top',
  'margin-right',
  'margin-bottom',
  'margin-left',
  'display',
  'flex',
  'flex-direction',
  'flex-wrap',
  'align-items',
  'justify-content',
  'gap',
  'grid-template-columns',
  'column-gap',
  'row-gap',
  'width',
  'height',
  'min-width',
  'min-height',
  'max-width',
  'max-height',
  'box-shadow',
  'opacity',
  'vertical-align',
  'white-space',
  'overflow',
  'object-fit',
] as const

/** Inline computed RGB styles so html2canvas avoids unsupported oklab/oklch in stylesheets. */
export function inlineComputedStyles(source: Element, target: Element): void {
  const sourceNodes = [source, ...source.querySelectorAll('*')]
  const targetNodes = [target, ...target.querySelectorAll('*')]

  sourceNodes.forEach((sourceNode, index) => {
    const targetNode = targetNodes[index]
    if (!(sourceNode instanceof HTMLElement) || !(targetNode instanceof HTMLElement)) return

    const computed = window.getComputedStyle(sourceNode)
    for (const prop of VISUAL_STYLE_PROPS) {
      const value = computed.getPropertyValue(prop)
      if (value) {
        targetNode.style.setProperty(prop, value)
      }
    }
  })
}

export async function waitForImages(root: HTMLElement): Promise<void> {
  const images = Array.from(root.querySelectorAll('img'))
  await Promise.all(
    images.map(
      (img) =>
        img.complete
          ? Promise.resolve()
          : new Promise<void>((resolve) => {
              img.addEventListener('load', () => resolve(), { once: true })
              img.addEventListener('error', () => resolve(), { once: true })
            }),
    ),
  )
}

export async function captureElementToCanvas(
  element: HTMLElement,
  options?: { scale?: number },
): Promise<HTMLCanvasElement> {
  await waitForImages(element)
  if (document.fonts?.ready) {
    await document.fonts.ready
  }

  const { default: html2canvas } = await import('html2canvas')

  return html2canvas(element, {
    scale: options?.scale ?? 2,
    useCORS: true,
    logging: false,
    onclone: (_document, clonedElement) => {
      inlineComputedStyles(element, clonedElement)
    },
  })
}
