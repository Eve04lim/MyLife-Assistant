// src/lib/utils.ts
import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

/**
 * Tailwind のクラス結合補助。
 * - clsx: 条件付きクラス
 * - tailwind-merge: 重複ユーティリティの優先解決
 */
export function cn(...inputs: unknown[]) {
  return twMerge(clsx(inputs))
}
