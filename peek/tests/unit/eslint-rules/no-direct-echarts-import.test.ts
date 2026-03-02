import { RuleTester } from "eslint";
import { describe, it } from "vitest";

import rule from "../../../eslint-plugin-peek/rules/no-direct-echarts-import.js";

const tester = new RuleTester({ languageOptions: { ecmaVersion: 2022, sourceType: "module" } });

describe("peek/no-direct-echarts-import", () => {
  it("passes RuleTester valid/invalid cases", () => {
    tester.run("no-direct-echarts-import", rule, {
      valid: [
        { code: `import { EChart } from "@perses-dev/components";` },
        {
          code: `import * as echarts from "echarts/core";`,
          filename: "src/components/perses/PersesEChartWrapper.tsx",
        },
        {
          code: `import * as echarts from "echarts/core";`,
          filename: "tests/unit/mytest.test.ts",
        },
      ],
      invalid: [
        {
          code: `import * as echarts from "echarts/core";`,
          filename: "src/components/visualizations/TimeSeriesChart.tsx",
          errors: [{ messageId: "noDirectECharts" }],
        },
        {
          code: `import { LineChart } from "echarts/charts";`,
          filename: "src/components/visualizations/BarChart.tsx",
          errors: [{ messageId: "noDirectECharts" }],
        },
      ],
    });
  });
});
