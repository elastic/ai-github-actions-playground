import type { EsqlResponse } from "../../types";

import { NUMERIC_TYPES } from "./esFieldTypes";

export function findNumericColumnIndices(data: EsqlResponse): number[] {
  return data.columns
    .map((column, index) => (NUMERIC_TYPES.has(column.type) ? index : -1))
    .filter((index) => index >= 0);
}
