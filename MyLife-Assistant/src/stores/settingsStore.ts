import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'
import type { Settings, MonthStartDay } from '@/features/settings/domain/types'

type SettingsState = {
  settings: Settings
}

type SettingsActions = {
  updateSettings: (patch: Partial<Settings>) => void
  setMonthStartDay: (d: MonthStartDay) => void
  reset: () => void
}

export type SettingsStore = SettingsState & SettingsActions

const STORAGE_KEY = 'mla:settings:v1'

const DEFAULT_SETTINGS: Settings = {
  monthStartDay: 1,
  monthlyBudget: 100000, // 仮の初期値（あとでUIから変更）
}

export const useSettingsStore = create<SettingsStore>()(
  persist(
    immer((set) => ({
      settings: DEFAULT_SETTINGS,

      updateSettings: (patch) =>
        set((s) => {
          s.settings = { ...s.settings, ...patch }
        }),

      setMonthStartDay: (d) =>
        set((s) => {
          s.settings.monthStartDay = d
        }),

      reset: () =>
        set((s) => {
          s.settings = DEFAULT_SETTINGS
        }),
    })),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      version: 1,
    }
  )
)

// セレクタ
export const useSettings = () => useSettingsStore((s) => s.settings)
