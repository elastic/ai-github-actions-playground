import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";

import PageContainer from "../../src/components/PageContainer";

describe("PageContainer", () => {
  it("renders children", () => {
    render(
      <PageContainer>
        <div data-testid="child">Hello</div>
      </PageContainer>,
    );
    expect(screen.getByTestId("child")).toBeInTheDocument();
  });

  it("renders multiple children", () => {
    render(
      <PageContainer>
        <div data-testid="a">A</div>
        <div data-testid="b">B</div>
      </PageContainer>,
    );
    expect(screen.getByTestId("a")).toBeInTheDocument();
    expect(screen.getByTestId("b")).toBeInTheDocument();
  });

  it("accepts custom gap prop", () => {
    const { container } = render(
      <PageContainer gap={2}>
        <div>Content</div>
      </PageContainer>,
    );
    expect(container.firstElementChild).toBeTruthy();
  });
});
