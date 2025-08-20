import { render, screen } from "@testing-library/react";
import { CityPopup } from "../CityPopup";
import type { JourneyCity } from "../../types";

describe("CityPopup", () => {
  const mockCity: JourneyCity = {
    city: "Austin",
    state: "TX",
    lat: 30.2672,
    lng: -97.7431,
  };

  it("renders city title and placeholder cards", () => {
    render(<CityPopup city={mockCity} onClose={() => {}} />);
    expect(screen.getByText(/Austin, TX/i)).toBeInTheDocument();
    // Should render 6 placeholder cards with "Coming soon"
    expect(screen.getAllByText(/Coming\s*soon/i)).toHaveLength(6);
  });
});
