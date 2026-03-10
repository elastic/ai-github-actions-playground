import { beforeEach, describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

import StepVariables from "../../src/components/packageBuilder/StepVariables";
import { resetAllStores } from "../fixtures/test-utils";

describe("StepVariables variable card identity", () => {
  beforeEach(() => {
    resetAllStores();
  });

  it("keeps the same Variable name input node mounted while editing", () => {
    render(<StepVariables />);

    fireEvent.click(screen.getByRole("button", { name: "Add variable" }));

    const inputBefore = screen.getByLabelText("Variable name") as HTMLInputElement;
    inputBefore.focus();

    fireEvent.change(inputBefore, { target: { value: "service_name" } });

    const inputAfter = screen.getByLabelText("Variable name") as HTMLInputElement;

    expect(inputAfter.value).toBe("service_name");
    expect(inputAfter).toBe(inputBefore);
    expect(document.activeElement).toBe(inputAfter);
  });
});
