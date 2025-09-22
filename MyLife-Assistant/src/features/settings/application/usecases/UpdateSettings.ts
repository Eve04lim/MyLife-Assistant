import type { Settings } from '@/features/settings/domain/types'
import { useSettingsStore } from '@/stores/settingsStore'

/** 設定更新のユースケース（将来APIやRepositoryに差し替えるための窓口） */
export function updateSettings(patch: Partial<Settings>) {
  useSettingsStore.getState().updateSettings(patch)
}
