import {
  gutter,
  GutterMarker,
  EditorView,
  Decoration,
  type DecorationSet,
  ViewPlugin,
  type ViewUpdate,
} from "@codemirror/view";
import { StateField, StateEffect, RangeSet, RangeSetBuilder } from "@codemirror/state";
import type { SlotInsight } from "../../types/insightSlots";

/* ── Severity → colour mapping ── */

const SEVERITY_BG: Record<string, string> = {
  info: "rgba(33,150,243,0.08)",
  warning: "rgba(255,152,0,0.10)",
  critical: "rgba(244,67,54,0.12)",
};

const SEVERITY_DOT: Record<string, string> = {
  info: "#2196f3",
  warning: "#ff9800",
  critical: "#f44336",
};

/* ── State effect to push insights into CM ── */

export const setInsights = StateEffect.define<SlotInsight[]>();

/* ── State field: line number → insight ── */

interface InsightMap {
  byLine: Map<number, SlotInsight>;
}

const insightField = StateField.define<InsightMap>({
  create: () => ({ byLine: new Map() }),
  update(value, tr) {
    for (const e of tr.effects) {
      if (e.is(setInsights)) {
        const byLine = new Map<number, SlotInsight>();
        for (const insight of e.value) {
          const match = insight.slotId.match(/^line-(\d+)$/);
          if (match) {
            byLine.set(Number(match[1]), insight);
          }
        }
        return { byLine };
      }
    }
    return value;
  },
});

/* ── Gutter marker: coloured dot ── */

class InsightDot extends GutterMarker {
  constructor(
    readonly severity: string,
    readonly text: string,
  ) {
    super();
  }

  override toDOM(): HTMLElement {
    const dot = document.createElement("span");
    dot.className = "cm-insight-dot";
    dot.title = this.text;
    const color = SEVERITY_DOT[this.severity] ?? SEVERITY_DOT.info;
    dot.style.cssText = `
      display: inline-block;
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: ${color};
      cursor: pointer;
      margin: 3px 2px;
    `;
    return dot;
  }
}

const insightGutter = gutter({
  class: "cm-insight-gutter",
  markers(view) {
    const { byLine } = view.state.field(insightField);
    const markers: { from: number; marker: GutterMarker }[] = [];
    for (const [lineIdx, insight] of byLine) {
      if (lineIdx < view.state.doc.lines) {
        const line = view.state.doc.line(lineIdx + 1);
        markers.push({
          from: line.from,
          marker: new InsightDot(insight.severity ?? "info", insight.text),
        });
      }
    }
    // Sort by position (required by CM)
    markers.sort((a, b) => a.from - b.from);
    return RangeSet.of(markers.map((m) => m.marker.range(m.from)));
  },
  initialSpacer: () => new InsightDot("info", ""),
});

/* ── Line background decorations ── */

function buildDecorations(view: EditorView): DecorationSet {
  const { byLine } = view.state.field(insightField);
  const builder = new RangeSetBuilder<Decoration>();
  // Lines must be added in document order
  const sortedLines = [...byLine.keys()].sort((a, b) => a - b);
  for (const lineIdx of sortedLines) {
    if (lineIdx < view.state.doc.lines) {
      const insight = byLine.get(lineIdx)!;
      const severity = insight.severity ?? "info";
      const bg = SEVERITY_BG[severity] ?? SEVERITY_BG.info;
      const line = view.state.doc.line(lineIdx + 1);
      builder.add(
        line.from,
        line.from,
        Decoration.line({ attributes: { style: `background-color: ${bg}` } }),
      );
    }
  }
  return builder.finish();
}

const insightLineHighlight = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;
    constructor(view: EditorView) {
      this.decorations = buildDecorations(view);
    }
    update(update: ViewUpdate) {
      if (
        update.docChanged ||
        update.transactions.some((tr) => tr.effects.some((e) => e.is(setInsights)))
      ) {
        this.decorations = buildDecorations(update.view);
      }
    }
  },
  { decorations: (v) => v.decorations },
);

/* ── Tooltip on gutter click ── */

/* ── CSS for the gutter width ── */

const gutterTheme = EditorView.theme({
  ".cm-insight-gutter": {
    width: "16px",
    cursor: "pointer",
  },
});

/* ── Public: bundle all extensions ── */

export function insightGutterExtension() {
  let cleanupPopover: (() => void) | null = null;

  const insightGutterClick = EditorView.domEventHandlers({
    click(event, view) {
      const target = event.target as HTMLElement;
      if (!target.classList.contains("cm-insight-dot")) return false;
      const lineBlock = view.lineBlockAtHeight(event.clientY - view.documentTop);
      if (!lineBlock) return false;
      const line = view.state.doc.lineAt(lineBlock.from);
      const lineIdx = line.number - 1;
      const { byLine } = view.state.field(insightField);
      const insight = byLine.get(lineIdx);
      if (!insight) return false;

      cleanupPopover?.();

      const popover = document.createElement("div");
      popover.className = "cm-insight-popover";
      const severity = insight.severity ?? "info";
      const borderColor = SEVERITY_DOT[severity] ?? SEVERITY_DOT.info;
      popover.style.cssText = `
        position: fixed;
        z-index: 10000;
        max-width: 320px;
        padding: 8px 12px;
        background: var(--cm-insight-popover-bg, #fff);
        color: var(--cm-insight-popover-color, #222);
        border: 1px solid ${borderColor};
        border-radius: 6px;
        box-shadow: 0 4px 16px rgba(0,0,0,0.15);
        font-size: 13px;
        line-height: 1.5;
        left: ${event.clientX + 8}px;
        top: ${event.clientY + 8}px;
      `;
      popover.textContent = insight.text;
      document.body.appendChild(popover);

      let timerId: number | null = null;
      const dismiss = () => {
        popover.remove();
        if (timerId !== null) {
          window.clearTimeout(timerId);
        }
        document.removeEventListener("click", dismiss, true);
        if (cleanupPopover === dismiss) {
          cleanupPopover = null;
        }
      };
      cleanupPopover = dismiss;
      timerId = window.setTimeout(() => document.addEventListener("click", dismiss, true), 0);

      return true;
    },
  });

  const insightPopoverCleanup = ViewPlugin.fromClass(
    class {
      destroy() {
        cleanupPopover?.();
        cleanupPopover = null;
      }
    },
  );

  return [
    insightField,
    insightGutter,
    insightLineHighlight,
    insightGutterClick,
    insightPopoverCleanup,
    gutterTheme,
  ];
}
