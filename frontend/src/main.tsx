import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import "./tokens.css";
import App from "./App.tsx";
import { TipProvider } from "./components/TipSystem";
import AdminRoot from "./AdminRoot";
import { CartProvider } from "./hooks/useCart";

const path = window.location.pathname;

const RootComponent = path.startsWith("/admin") ? AdminRoot : App;

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <TipProvider>
      <CartProvider>
        <RootComponent />
      </CartProvider>
    </TipProvider>
  </StrictMode>
);
