declare module 'html-to-image' {
  export interface ToPngOptions {
    cacheBust?: boolean
    pixelRatio?: number
    backgroundColor?: string
    // 使う可能性のある代表的なオプションを列挙（必要に応じて拡張可）
    width?: number
    height?: number
    quality?: number
    canvasWidth?: number
    canvasHeight?: number
    style?: Partial<CSSStyleDeclaration>
    filter?: (node: HTMLElement) => boolean
  }

  export const toPng: (node: HTMLElement, options?: ToPngOptions) => Promise<string>
}
