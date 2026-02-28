import type { Layout, LayoutItem, ResponsiveLayouts as Layouts } from "react-grid-layout";

import type { PanelDefinition } from "../../types";

export interface PersesPanelLayout {
  kind: "grid";
  spec: {
    x: number;
    y: number;
    width: number;
    height: number;
    minWidth: number;
    minHeight: number;
  };
}

export function toPersesPanelLayouts(panels: PanelDefinition[]): Record<string, PersesPanelLayout> {
  return Object.fromEntries(
    panels.map((panel) => [
      panel.id,
      {
        kind: "grid",
        spec: {
          x: panel.layout.x,
          y: panel.layout.y,
          width: panel.layout.w,
          height: panel.layout.h,
          minWidth: 2,
          minHeight: 2,
        },
      } satisfies PersesPanelLayout,
    ]),
  );
}

export function toReactGridLayouts(persesLayouts: Record<string, PersesPanelLayout>): Layouts {
  return {
    lg: Object.entries(persesLayouts).map(([id, layout]) => ({
      i: id,
      x: layout.spec.x,
      y: layout.spec.y,
      w: layout.spec.width,
      h: layout.spec.height,
      minW: layout.spec.minWidth,
      minH: layout.spec.minHeight,
    })),
  };
}

export function fromReactGridLayoutItems(
  layoutItems: Layout,
): Array<{ id: string; x: number; y: number; w: number; h: number }> {
  return layoutItems.map((item: LayoutItem) => ({
    id: item.i,
    x: item.x,
    y: item.y,
    w: item.w,
    h: item.h,
  }));
}
