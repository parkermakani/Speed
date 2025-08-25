import { render, screen, fireEvent } from "@testing-library/react";
import { TipProvider } from "../../components/TipSystem";

// Mock the tipsConfig to control steps deterministically for tests
vi.mock("../../tips/tipsConfig", async () => {
  const mod: any = await vi.importActual("../../tips/tipsConfig");
  const tipsConfig = [
    {
      id: "s1",
      imageUrl: "/img1.png",
      target: '[data-tip-target="t1"]',
      continueMode: "tapAnywhere",
      placementDesktop: { offsetX: 0, offsetY: 0, anchor: "center" },
      placementMobile: { offsetX: 0, offsetY: 0, anchor: "center" },
    },
    {
      id: "s2",
      imageUrl: "/img2.png",
      target: '[data-tip-target="t2"]',
      continueMode: "clickTarget",
      placementDesktop: { offsetX: 0, offsetY: 0, anchor: "center" },
      placementMobile: { offsetX: 0, offsetY: 0, anchor: "center" },
    },
  ];
  return { ...mod, tipsConfig };
});

const TestTargets = () => (
  <div>
    <div data-tip-target="t1">Target One</div>
    <button data-tip-target="t2">Target Two</button>
  </div>
);

const setUrl = (query: string) => {
  const url = `http://localhost/${query ? `?${query}` : ""}`;
  window.history.replaceState({}, "", url);
};

describe("TipSystem", () => {
  beforeEach(() => {
    sessionStorage.clear();
    localStorage.removeItem("tips_suppressed");
  });

  it("forces open first step with tipsForce and advances on tapAnywhere", async () => {
    setUrl("tipsForce=1");
    render(
      <TipProvider>
        <TestTargets />
      </TipProvider>
    );
    // First step image should render
    const img1 = await screen.findByAltText("Tip");
    expect((img1 as HTMLImageElement).getAttribute("src")).toContain(
      "/img1.png"
    );

    // Click the image to advance (tapAnywhere)
    fireEvent.click(img1);
    const img2 = await screen.findByAltText("Tip");
    expect((img2 as HTMLImageElement).getAttribute("src")).toContain(
      "/img2.png"
    );
  });

  it("requires clicking the target for clickTarget step", async () => {
    setUrl("tipsForce=1&tipsIndex=1"); // start at s2 (clickTarget)
    render(
      <TipProvider>
        <TestTargets />
      </TipProvider>
    );
    const img2 = await screen.findByAltText("Tip");
    expect((img2 as HTMLImageElement).getAttribute("src")).toContain(
      "/img2.png"
    );

    // Clicking elsewhere should not advance
    fireEvent.click(img2);
    expect((await screen.findByAltText("Tip")).getAttribute("src")).toContain(
      "/img2.png"
    );

    // Clicking target advances (closes tips because only two steps)
    const targetTwo = screen.getByText("Target Two");
    fireEvent.click(targetTwo);
    // Overlay should disappear (no dialog)
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("closes on Escape", async () => {
    setUrl("tipsForce=1");
    render(
      <TipProvider>
        <TestTargets />
      </TipProvider>
    );
    // overlay/dialog present
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    // Esc closes
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
