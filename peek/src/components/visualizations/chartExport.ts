export type EChartImageExporter = {
  getDataURL: (opts: { type: "png"; pixelRatio: number }) => string;
};

export function createPngExporter(instanceRef: { current: EChartImageExporter | undefined }) {
  return () => instanceRef.current?.getDataURL({ type: "png", pixelRatio: 2 }) ?? "";
}
