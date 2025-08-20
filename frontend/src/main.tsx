import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import "./tokens.css";
import App from "./App.tsx";
import AdminRoot from "./AdminRoot";

const path = window.location.pathname;

const RootComponent = path.startsWith("/admin") ? AdminRoot : App;

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <RootComponent />
  </StrictMode>
);
