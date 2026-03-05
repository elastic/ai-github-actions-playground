import { useMemo, useRef, useEffect } from "react";
import { EditorView } from "@codemirror/view";

import { createEsqlQueryEditorExtensions } from "../queryEditorExtensions";

/** ES|QL extensions for trace editors — delegates to the shared ES|QL pack. */
export function useTraceQueryEditorExtensions(onRun: () => void) {
  const onRunRef = useRef(onRun);
  useEffect(() => {
    onRunRef.current = onRun;
  }, [onRun]);

  return useMemo(
    () => [
      EditorView.lineWrapping,
      // eslint-disable-next-line react-hooks/refs -- callback invoked on keypress, ref read is deferred
      ...createEsqlQueryEditorExtensions(() => onRunRef.current()),
    ],
    [],
  );
}
