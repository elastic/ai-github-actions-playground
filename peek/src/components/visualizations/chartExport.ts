import type { ComponentProps } from "react";
import type { EChart } from "@perses-dev/components";

export type EChartImageExporter = {
  getDataURL: (opts: { type: "png"; pixelRatio: number }) => string;
};

export function createPngExporter(instanceRef: { current: EChartImageExporter | undefined }) {
  return () => instanceRef.current?.getDataURL({ type: "png", pixelRatio: 2 }) ?? "";
}

type EChartInstanceRef = NonNullable<ComponentProps<typeof EChart>["_instance"]>;
export type EChartInstance = NonNullable<EChartInstanceRef["current"]>;
