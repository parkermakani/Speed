import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";
import { CartProvider, useCart } from "../../hooks/useCart";
import { CartPanel } from "../../components/CartPanel";

function Wrapper({ children }: { children: React.ReactNode }) {
  return <CartProvider>{children}</CartProvider>;
}

describe("Cart basic flow", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("adds item and prints on checkout", () => {
    // Minimal harness that adds an item through context using an inline button
    const TestHarness = () => {
      const cart = useCart();
      return (
        <div>
          <button
            onClick={() =>
              cart.addItem(
                {
                  id: "1",
                  name: "Test Tee",
                  price: "$10",
                  imageUrl: "img",
                },
                2
              )
            }
          >
            add
          </button>
          <CartPanel />
        </div>
      );
    };

    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    const alertSpy = vi.spyOn(window, "alert").mockImplementation(() => {});

    render(
      <Wrapper>
        <TestHarness />
      </Wrapper>
    );

    fireEvent.click(screen.getByText("add"));
    // Ensure item appears
    expect(screen.getByText("Test Tee")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Checkout"));
    expect(log).toHaveBeenCalledWith("Checkout items:", "2 x Test Tee ($10)");
    expect(alertSpy).toHaveBeenCalled();

    log.mockRestore();
    alertSpy.mockRestore();
  });
});
