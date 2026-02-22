import { keymap } from "@codemirror/view";
import type { Extension } from "@codemirror/state";

export function runQueryShortcutExtension(runQuery: () => void): Extension {
  return keymap.of([
    {
      key: "Mod-Enter",
      run: () => {
        runQuery();
        return true;
      },
    },
  ]);
}
