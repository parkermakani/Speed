import { useState, useEffect } from "react";
import { FlatMap } from "./components/FlatMap";
import { Header } from "./components/Header";
import { Footer } from "./components/Footer";
import { Quote } from "./components/Quote";
import type { Status, JourneyResponse } from "./types";
import { fetchStatus, fetchJourney, fetchSleep } from "./services/api";
import type { SleepResponse } from "./types";
import "./App.css";
import { Drawer } from "./components/primitives/Drawer";
import { ShopTab } from "./components/ShopTab";
import { Merch } from "./components/Merch";

function App() {
  const [status, setStatus] = useState<Status | null>(null);
  const [journey, setJourney] = useState<JourneyResponse | null>(null);
  const [sleep, setSleep] = useState<SleepResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [shopOpen, setShopOpen] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [statusRes, journeyRes, sleepRes] = await Promise.all([
          fetchStatus(),
          fetchJourney(),
          fetchSleep(),
        ]);
        setStatus(statusRes);
        setJourney(journeyRes);
        setSleep(sleepRes);
      } catch (error) {
        console.error("Failed to load data:", error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  if (loading) {
    return <div className="app loading">Loading...</div>;
  }

  if (!status || !journey || !sleep) {
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

      {sleep.isSleep ? (
        <div
          style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "var(--color-surface)",
            color: "var(--color-text-secondary)",
          }}
        >
          <p>Map is sleeping – come back soon!</p>
        </div>
      ) : (
        <div className="map-container">
          <FlatMap
            lat={journey.currentCity?.lat || status.lat}
            lng={journey.currentCity?.lng || status.lng}
            state={journey.currentCity?.state || status.state}
            path={[
              ...journey.path.map((p) => ({ lat: p.lat, lng: p.lng })),
              ...(journey.currentCity
                ? [
                    {
                      lat: journey.currentCity.lat,
                      lng: journey.currentCity.lng,
                    },
                  ]
                : []),
            ]}
            pastCities={journey.path.map((p) => ({ lat: p.lat, lng: p.lng }))}
          />
        </div>
      )}

      {/* Footer overlay */}
      <Footer />

      {/* Shop UI */}
      <ShopTab isOpen={shopOpen} toggle={() => setShopOpen((o) => !o)} />
      <Drawer isOpen={shopOpen} onClose={() => setShopOpen(false)}>
        {shopOpen && <Merch />}
      </Drawer>
    </div>
  );
}

export default App;
