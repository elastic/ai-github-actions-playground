import { describe, it, expect } from "vitest";
import { EditorState } from "@codemirror/state";

import {
  suggestionField,
  setSuggestion,
  clearSuggestion,
  ghostDiffExtension,
} from "../../src/components/ghostDiffExtension";

function createState(doc = "FROM logs-* | WHERE host = 'a'") {
  return EditorState.create({
    doc,
    extensions: [ghostDiffExtension],
  });
}

describe("ghostDiffExtension", () => {
  describe("suggestionField", () => {
    it("starts as null", () => {
      const state = createState();
      expect(state.field(suggestionField)).toBeNull();
    });

    it("stores a suggestion via setSuggestion effect", () => {
      const state = createState();
      const suggestion = { from: 14, to: 30, replacement: "STATS count = COUNT(*)" };
      const tr = state.update({ effects: setSuggestion.of(suggestion) });
      expect(tr.state.field(suggestionField)).toEqual(suggestion);
    });

    it("clears via clearSuggestion effect", () => {
      const state = createState();
      const suggestion = { from: 14, to: 30, replacement: "STATS count = COUNT(*)" };
      let next = state.update({ effects: setSuggestion.of(suggestion) }).state;
      next = next.update({ effects: clearSuggestion.of(null) }).state;
      expect(next.field(suggestionField)).toBeNull();
    });

    it("auto-clears on document change", () => {
      const state = createState();
      const suggestion = { from: 14, to: 30, replacement: "STATS count = COUNT(*)" };
      let next = state.update({ effects: setSuggestion.of(suggestion) }).state;
      // Simulate typing
      next = next.update({ changes: { from: 30, insert: " " } }).state;
      expect(next.field(suggestionField)).toBeNull();
    });

    it("discards suggestion with from > to", () => {
      const state = createState();
      const tr = state.update({
        effects: setSuggestion.of({ from: 20, to: 10, replacement: "test" }),
      });
      expect(tr.state.field(suggestionField)).toBeNull();
    });

    it("discards suggestion with to beyond doc length", () => {
      const state = createState("short");
      const tr = state.update({
        effects: setSuggestion.of({ from: 0, to: 100, replacement: "test" }),
      });
      expect(tr.state.field(suggestionField)).toBeNull();
    });

    it("discards suggestion with negative from", () => {
      const state = createState();
      const tr = state.update({
        effects: setSuggestion.of({ from: -1, to: 5, replacement: "test" }),
      });
      expect(tr.state.field(suggestionField)).toBeNull();
    });

    it("accepts append-only suggestion where from === to", () => {
      const state = createState();
      const suggestion = { from: 10, to: 10, replacement: "| LIMIT 10" };
      const tr = state.update({ effects: setSuggestion.of(suggestion) });
      expect(tr.state.field(suggestionField)).toEqual(suggestion);
    });

    it("preserves suggestion through non-doc transactions", () => {
      const state = createState();
      const suggestion = { from: 0, to: 4, replacement: "ROW" };
      let next = state.update({ effects: setSuggestion.of(suggestion) }).state;
      // Selection-only change (no doc change)
      next = next.update({ selection: { anchor: 5 } }).state;
      expect(next.field(suggestionField)).toEqual(suggestion);
    });
  });

  describe("Tab accept", () => {
    it("replaces text when suggestion is in replace mode", () => {
      const doc = "FROM logs-* | count events by host";
      const state = createState(doc);
      const suggestion = {
        from: 14,
        to: doc.length,
        replacement: "STATS event_count = COUNT(*) BY host.name",
      };
      // Set suggestion
      let next = state.update({ effects: setSuggestion.of(suggestion) }).state;
      // Simulate Tab accept by applying the same changes Tab would
      next = next.update({
        changes: { from: 14, to: doc.length, insert: "STATS event_count = COUNT(*) BY host.name" },
        effects: clearSuggestion.of(null),
        selection: { anchor: 14 + "STATS event_count = COUNT(*) BY host.name".length },
        userEvent: "input.complete",
      }).state;

      expect(next.doc.toString()).toBe("FROM logs-* | STATS event_count = COUNT(*) BY host.name");
      expect(next.field(suggestionField)).toBeNull();
    });

    it("inserts text when suggestion is in append mode", () => {
      const state = createState("FROM logs-*");
      const suggestion = { from: 11, to: 11, replacement: " | LIMIT 10" };
      let next = state.update({ effects: setSuggestion.of(suggestion) }).state;
      next = next.update({
        changes: { from: 11, to: 11, insert: " | LIMIT 10" },
        effects: clearSuggestion.of(null),
        selection: { anchor: 22 },
        userEvent: "input.complete",
      }).state;

      expect(next.doc.toString()).toBe("FROM logs-* | LIMIT 10");
      expect(next.field(suggestionField)).toBeNull();
    });
  });
});
