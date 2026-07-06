import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface SettingsState {
  /** OpenAI-compatible base URL, e.g. https://api.openai.com/v1 */
  endpoint: string;
  /** User-supplied API key. Lives only in localStorage, never leaves the browser. */
  apiKey: string;
  /** Model id to request, e.g. gpt-4o-mini or claude-3-5-sonnet */
  model: string;
  setSettings: (
    patch: Partial<Pick<SettingsState, "endpoint" | "apiKey" | "model">>,
  ) => void;
  isConfigured: () => boolean;
}

export const useSettings = create<SettingsState>()(
  persist(
    (set, get) => ({
      endpoint: "",
      apiKey: "",
      model: "",
      setSettings: (patch) => set(patch),
      isConfigured: () => {
        const { endpoint, apiKey, model } = get();
        return Boolean(endpoint && apiKey && model);
      },
    }),
    { name: "auwe-settings" },
  ),
);
