import { useState, useEffect } from "react";
import { Demo } from "./pages/Demo";
import { AdminLogin } from "./pages/AdminLogin";
import { AdminDashboard } from "./pages/AdminDashboard";
import App from "./App";
import { Button } from "./components/primitives";
import { useAuth } from "./hooks/useAuth";

export function DemoApp() {
  // derive initial view from location
  const getViewFromPath = (path: string): "app" | "demo" | "admin" => {
    if (path.startsWith("/demo")) return "demo";
    if (path.startsWith("/admin")) return "admin";
    return "app";
  };

  const [currentView, setCurrentView] = useState<"app" | "demo" | "admin">(
    getViewFromPath(window.location.pathname)
  );

  // sync browser history when view changes
  useEffect(() => {
    const desiredPath = currentView === "app" ? "/" : `/${currentView}`;
    if (window.location.pathname !== desiredPath) {
      window.history.pushState({}, "", desiredPath);
    }
  }, [currentView]);

  // handle back/forward
  useEffect(() => {
    const handler = () => {
      setCurrentView(getViewFromPath(window.location.pathname));
    };
    window.addEventListener("popstate", handler);
    return () => window.removeEventListener("popstate", handler);
  }, []);

  const { isAuthenticated, loading } = useAuth();

  const renderAdminView = () => {
    if (loading) {
      return (
        <div
          style={{
            minHeight: "100vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "var(--color-bg)",
            color: "var(--color-text)",
          }}
        >
          Loading...
        </div>
      );
    }

    if (!isAuthenticated) {
      return <AdminLogin onLoginSuccess={() => {}} />;
    }

    return (
      <AdminDashboard
        onStatusUpdate={() => {
          // Force refresh the main app if it's visible
          window.location.reload();
        }}
      />
    );
  };

  return (
    <div>
      {/* Navigation buttons */}
      <div
        style={{
          position: "fixed",
          top: "var(--space-4)",
          right: "var(--space-4)",
          zIndex: "var(--z-overlay)",
          display: "flex",
          gap: "var(--space-2)",
        }}
      >
        {currentView !== "app" && (
          <Button variant="secondary" onClick={() => setCurrentView("app")}>
            Map
          </Button>
        )}
        {currentView !== "demo" && (
          <Button variant="secondary" onClick={() => setCurrentView("demo")}>
            Demo
          </Button>
        )}
        {currentView !== "admin" && (
          <Button variant="secondary" onClick={() => setCurrentView("admin")}>
            Admin
          </Button>
        )}
      </div>

      {/* Render current view */}
      {currentView === "app" && <App />}
      {currentView === "demo" && <Demo />}
      {currentView === "admin" && renderAdminView()}
    </div>
  );
}
