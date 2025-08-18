import { useState, useEffect } from "react";
import { FlatMap } from "./components/FlatMap";
import { Header } from "./components/Header";
import { Quote } from "./components/Quote";
import type { Status } from "./types";
import { fetchStatus } from "./services/api";
import "./App.css";

function App() {
  const [status, setStatus] = useState<Status | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadStatus = async () => {
      try {
        const data = await fetchStatus();
        setStatus(data);
      } catch (error) {
        console.error("Failed to fetch status:", error);
      } finally {
        setLoading(false);
      }
    };

    loadStatus();
  }, []);

  if (loading) {
    return <div className="app loading">Loading...</div>;
  }

  if (!status) {
    return <div className="app error">Failed to load map data</div>;
  }

  return (
    <div className="app">
      {/* Overlay stack: header + quote */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          zIndex: 60,
        }}
      >
        <Header />
        <Quote quote={status.quote} />
      </div>

      <div className="map-container">
        <FlatMap lat={status.lat} lng={status.lng} state={status.state} />
      </div>
    </div>
  );
}

export default App;
