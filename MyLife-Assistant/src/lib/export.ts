// 型は d.ts で与える。ランタイムは動的 import（バンドル時の取り回しも安定）
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
type HtmlToImage = typeof import('html-to-image')

/** 現在のテーマから背景色を取得（なければ白） */
function getBackgroundColor(): string {
  const root = document.documentElement
  const bg = getComputedStyle(root).getPropertyValue('--color-background').trim()
  return bg || '#ffffff'
}

/** 要素を PNG として保存 */
export async function exportElementToPng(el: HTMLElement, filename = 'export.png') {
  const htmlToImage = (await import('html-to-image')) as unknown as HtmlToImage
  const backgroundColor = getBackgroundColor()
  // ピクセル密度を上げて文字/線をクッキリ
  const pixelRatio = Math.min(3, Math.max(2, Math.floor(window.devicePixelRatio || 2)))
  // フォントの一時固定（FOIT/FOUT軽減）
  const style = document.createElement('style')
  style.textContent = `
    * { -webkit-font-smoothing: antialiased; text-rendering: optimizeLegibility; }
  `
  el.appendChild(style)
  try {
    const dataUrl = await htmlToImage.toPng(el, {
      cacheBust: true,
      pixelRatio,
      backgroundColor,
      // foreignObjectRendering: true, // 必要なら有効化
      // filter: (node) => !(node instanceof HTMLButtonElement), // ボタンを除外したい場合
    })
    const a = document.createElement('a')
    a.href = dataUrl
    a.download = filename
    a.click()
  } finally {
    style.remove()
  }
}

/**
 * 新しいウィンドウに対象要素をクローンして印刷
 * - 既存ページの CSS に依存せず、!important も不要
 * - フォント/スタイル継承のため <base> と <style>/<link> を複製
 */
export function printElement(el: HTMLElement) {
  const w = window.open('', '_blank', 'noopener,noreferrer,width=1024,height=768')
  if (!w) return

  // head を複製（CSS/フォントを読み込む）
  const doc = w.document
  doc.open()
  doc.write('<!doctype html><html><head><meta charset="utf-8" /></head><body></body></html>')
  doc.close()

  const base = document.createElement('base')
  base.href = document.baseURI
  doc.head.appendChild(base)

  Array.from(document.head.querySelectorAll('style, link[rel="stylesheet"]')).forEach((node) => {
    doc.head.appendChild(node.cloneNode(true))
  })

  // 対象を包むラッパーを追加（背景はテーマ色）
  const wrapper = doc.createElement('div')
  wrapper.style.background = getBackgroundColor()
  wrapper.style.padding = '16px'
  wrapper.appendChild(el.cloneNode(true))
  doc.body.appendChild(wrapper)

  // スタイル読み込み後に印刷
  setTimeout(() => {
    w.focus()
    w.print()
    w.close()
  }, 100)
}
