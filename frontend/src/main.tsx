import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import "./tokens.css";
import App from "./App.tsx";
import SleepScreen from "./pages/SleepScreen";
import { TipProvider } from "./components/TipSystem";
import AdminRoot from "./AdminRoot";
import { CartProvider } from "./hooks/useCart";
import { TourProvider } from "./contexts/TourContext";

const path = window.location.pathname;

const RootComponent = path.startsWith("/admin")
  ? AdminRoot
  : path.startsWith("/sleep-screen")
  ? SleepScreen
  : App;

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <TourProvider>
      <TipProvider>
        <CartProvider>
          <RootComponent />
        </CartProvider>
      </TipProvider>
    </TourProvider>
  </StrictMode>
);
