import { useState, useEffect, useMemo } from "react";
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
import { Button, Icon } from "./components/primitives";
import { useTips } from "./components/TipSystem";
import { useCart } from "./hooks/useCart";
import { CartPanel } from "./components/CartPanel";
import { useMediaQuery } from "./hooks/useMediaQuery";

const SHOW_ADMIN_BTN = false;

function App() {
  const tips = useTips();
  const [status, setStatus] = useState<Status | null>(null);
  const [journey, setJourney] = useState<JourneyResponse | null>(null);
  const [sleep, setSleep] = useState<SleepResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [shopOpen, setShopOpen] = useState(false);
  const [shopSlidePx, setShopSlidePx] = useState<number | null>(null);
  const [shopDragging, setShopDragging] = useState(false);
  const [showCart, setShowCart] = useState(false);
  const cart = useCart();
  const isDesktop = useMediaQuery("(min-width: 1100px)");

  // Memoize heavy props for FlatMap so it doesn't re-render during drawer drag
  const memoPath = useMemo(() => {
    const p = journey?.path ?? [];
    const cc = journey?.currentCity;
    return [
      ...p.map((pt) => ({ lat: pt.lat, lng: pt.lng })),
      ...(cc ? [{ lat: cc.lat, lng: cc.lng }] : []),
    ];
  }, [journey?.path, journey?.currentCity]);

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
      {/* optional admin nav button */}
      {SHOW_ADMIN_BTN && (
        <div
          style={{
            position: "fixed",
            top: "var(--space-4)",
            right: "var(--space-4)",
            zIndex: 100,
          }}
        >
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              window.location.href = "/admin";
            }}
          >
            Admin
          </Button>
        </div>
      )}
      {/* Help tip trigger */}
      <div
        style={{
          position: "fixed",
          top: "var(--space-4)",
          left: "var(--space-4)",
          zIndex: 120,
        }}
      >
        <button
          type="button"
          aria-label="Help"
          data-tip-target="help"
          onClick={() => {
            tips.start();
          }}
          style={{
            width: 40,
            height: 40,
            background: "transparent",
            border: "none",
            outline: "none",
            boxShadow: "none",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
          }}
        >
          <Icon
            name="question-mark"
            size={40}
            preserveColors={false}
            fill="var(--color-land-dark)"
          />
        </button>
      </div>
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
        <FlatMap
          lat={journey.currentCity?.lat || status.lat}
          lng={journey.currentCity?.lng || status.lng}
          state={journey.currentCity?.state || status.state}
          path={memoPath}
          pastCities={journey.path}
          isSleep={sleep.isSleep}
        />

        {/* Removed sleep overlay per user request */}
      </div>

      {/* Footer overlay */}
      <Footer />

      {/* Shop UI */}
      <ShopTab
        isOpen={shopOpen}
        toggle={() => setShopOpen((o) => !o)}
        setOpen={(open) => setShopOpen(open)}
        setSlidePx={(px) => setShopSlidePx(px)}
        setDragging={(d) => setShopDragging(d)}
        slidePx={shopSlidePx}
        dragging={shopDragging}
      />
      <Drawer
        isOpen={shopOpen}
        onClose={() => {
          setShopOpen(false);
          setShowCart(false);
        }}
        slideOffsetPx={shopSlidePx}
        isDragging={shopDragging}
        title={showCart ? "Cart" : "Merch"}
        fancy={true}
        showBackButton={showCart || !isDesktop}
        onBack={() => {
          if (showCart) {
            setShowCart(false);
          } else {
            setShopOpen(false);
          }
        }}
        rightAction={
          !showCart ? (
            <button
              onClick={() => setShowCart((s) => !s)}
              style={{
                background: "transparent",
                border: "none",
                cursor: "pointer",
                padding: 8,
                outline: "none",
              }}
              aria-label="Cart"
            >
              <div style={{ position: "relative" }}>
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="var(--color-land-dark)"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="9" cy="21" r="1"></circle>
                  <circle cx="20" cy="21" r="1"></circle>
                  <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h7.72a2 2 0 0 0 2-1.61L23 6H6"></path>
                </svg>
                {cart.totalItems > 0 && (
                  <span
                    aria-label={`Cart items: ${cart.totalItems}`}
                    style={{
                      position: "absolute",
                      top: -4,
                      right: -4,
                      background: "var(--color-bg)",
                      color: "var(--color-land-dark)",
                      border: "2px solid var(--color-land-dark)",
                      borderRadius: 12,
                      minWidth: 18,
                      height: 18,
                      padding: "0 4px",
                      fontSize: 12,
                      lineHeight: "14px",
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    {cart.totalItems}
                  </span>
                )}
              </div>
            </button>
          ) : undefined
        }
      >
        {shopOpen && (showCart ? <CartPanel /> : <Merch />)}
      </Drawer>
    </div>
  );
}

export default App;
