import { AuthProvider, useAuth } from "./hooks/useAuth";
import { AdminLogin } from "./pages/AdminLogin";
import { AdminDashboard } from "./pages/AdminDashboard";

function Inner() {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        Loading...
      </div>
    );
  }

  if (!isAuthenticated)
    return (
      <AdminLogin
        onLoginSuccess={() => {
          window.location.reload();
        }}
      />
    );

  return <AdminDashboard />;
}

export default function AdminRoot() {
  return (
    <AuthProvider>
      <Inner />
    </AuthProvider>
  );
}
