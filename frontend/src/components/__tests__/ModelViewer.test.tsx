import { render } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { ModelViewer } from "../ModelViewer";

describe("ModelViewer", () => {
  it("renders a canvas element", () => {
    const { container } = render(<ModelViewer />);
    const canvas = container.querySelector("canvas");
    expect(canvas).toBeInTheDocument();
  });
});
