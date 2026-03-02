import { Prec, StateEffect, StateField, type Extension, type Transaction } from "@codemirror/state";
import { Decoration, EditorView, WidgetType, keymap } from "@codemirror/view";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface GhostDiffSuggestion {
  /** Start of the text range to replace (document position) */
  from: number;
  /** End of the text range to replace. If from === to, append-only mode. */
  to: number;
  /** The replacement text shown as ghost text */
  replacement: string;
}

// ---------------------------------------------------------------------------
// State effects
// ---------------------------------------------------------------------------

export const setSuggestion = StateEffect.define<GhostDiffSuggestion>();
export const clearSuggestion = StateEffect.define<null>();

// ---------------------------------------------------------------------------
// State field
// ---------------------------------------------------------------------------

function validateSuggestion(
  suggestion: GhostDiffSuggestion,
  tr: Transaction,
): GhostDiffSuggestion | null {
  if (suggestion.from < 0 || suggestion.to < suggestion.from || suggestion.to > tr.newDoc.length) {
    return null;
  }
  return suggestion;
}

export const suggestionField = StateField.define<GhostDiffSuggestion | null>({
  create() {
    return null;
  },
  update(value, tr) {
    for (const effect of tr.effects) {
      if (effect.is(setSuggestion)) {
        return validateSuggestion(effect.value, tr);
      }
      if (effect.is(clearSuggestion)) {
        return null;
      }
    }
    // Any document change dismisses the suggestion
    if (tr.docChanged) return null;
    return value;
  },
});

// ---------------------------------------------------------------------------
// Widgets
// ---------------------------------------------------------------------------

class GhostReplacementWidget extends WidgetType {
  constructor(readonly replacement: string) {
    super();
  }

  toDOM(): HTMLElement {
    const span = document.createElement("span");
    span.className = "cm-ghost-replacement";
    span.textContent = this.replacement;
    return span;
  }

  eq(other: GhostReplacementWidget): boolean {
    return this.replacement === other.replacement;
  }
}

class TabHintWidget extends WidgetType {
  toDOM(): HTMLElement {
    const span = document.createElement("span");
    span.className = "cm-ghost-tab-hint";
    span.textContent = "Tab";
    return span;
  }

  eq(): boolean {
    return true;
  }
}

// ---------------------------------------------------------------------------
// Decorations
// ---------------------------------------------------------------------------

const suggestionDecorations = EditorView.decorations.compute([suggestionField], (state) => {
  const suggestion = state.field(suggestionField);
  if (!suggestion) return Decoration.none;

  const { from, to, replacement } = suggestion;
  const decorations = [];

  // Replace mode: strikethrough the original text
  if (from < to) {
    decorations.push(Decoration.mark({ class: "cm-ghost-strikethrough" }).range(from, to));
  }

  // Ghost replacement text
  decorations.push(
    Decoration.widget({
      widget: new GhostReplacementWidget(replacement),
      side: 1,
    }).range(to),
  );

  // Tab hint badge
  decorations.push(
    Decoration.widget({
      widget: new TabHintWidget(),
      side: 1,
    }).range(to),
  );

  return Decoration.set(decorations, true);
});

// ---------------------------------------------------------------------------
// Keymap
// ---------------------------------------------------------------------------

// Prec.highest ensures Tab/Escape run before basicSetup's indentWithTab
const suggestionKeymap = Prec.highest(
  keymap.of([
    {
      key: "Tab",
      run(view) {
        const suggestion = view.state.field(suggestionField);
        if (!suggestion) return false;
        const { from, to, replacement } = suggestion;
        view.dispatch({
          changes: { from, to, insert: replacement },
          effects: clearSuggestion.of(null),
          selection: { anchor: from + replacement.length },
          userEvent: "input.complete",
        });
        return true;
      },
    },
    {
      key: "Escape",
      run(view) {
        const suggestion = view.state.field(suggestionField);
        if (!suggestion) return false;
        view.dispatch({ effects: clearSuggestion.of(null) });
        return true;
      },
    },
  ]),
);

// ---------------------------------------------------------------------------
// Theme (light + dark)
// ---------------------------------------------------------------------------

const themeLight = EditorView.theme({
  ".cm-ghost-strikethrough": {
    textDecoration: "line-through",
    opacity: "0.5",
    color: "#DE350B",
    fontStyle: "italic",
  },
  ".cm-ghost-replacement": {
    color: "#36B37E",
    opacity: "0.65",
    fontStyle: "italic",
    whiteSpace: "pre-wrap",
    textDecoration: "none",
    pointerEvents: "none",
  },
  ".cm-ghost-tab-hint": {
    display: "inline-flex",
    alignItems: "center",
    marginLeft: "6px",
    padding: "1px 5px",
    fontSize: "10px",
    fontFamily: "system-ui, sans-serif",
    fontStyle: "normal",
    color: "#64748b",
    background: "#f1f5f9",
    border: "1px solid #cbd5e1",
    borderRadius: "3px",
    verticalAlign: "middle",
    lineHeight: "1.4",
    pointerEvents: "none",
  },
});

const themeDark = EditorView.theme(
  {
    ".cm-ghost-strikethrough": {
      textDecoration: "line-through",
      opacity: "0.45",
      color: "#DE350B",
      fontStyle: "italic",
    },
    ".cm-ghost-replacement": {
      color: "#36B37E",
      opacity: "0.70",
      fontStyle: "italic",
      whiteSpace: "pre-wrap",
      textDecoration: "none",
      pointerEvents: "none",
    },
    ".cm-ghost-tab-hint": {
      display: "inline-flex",
      alignItems: "center",
      marginLeft: "6px",
      padding: "1px 5px",
      fontSize: "10px",
      fontFamily: "system-ui, sans-serif",
      fontStyle: "normal",
      color: "#94a3b8",
      background: "#1e293b",
      border: "1px solid #334155",
      borderRadius: "3px",
      verticalAlign: "middle",
      lineHeight: "1.4",
      pointerEvents: "none",
    },
  },
  { dark: true },
);

// ---------------------------------------------------------------------------
// Bundled extension
// ---------------------------------------------------------------------------

export const ghostDiffExtension: Extension = [
  suggestionField,
  suggestionDecorations,
  suggestionKeymap,
  themeLight,
  themeDark,
];
