import { useState, useEffect, useMemo } from "react";
import { FlatMap } from "./components/FlatMap";
import { Header } from "./components/Header";
import { Footer } from "./components/Footer";
import { Quote } from "./components/Quote";
import type { Status, JourneyResponse, Settings } from "./types";
import {
  fetchStatus,
  fetchJourney,
  fetchSleep,
  fetchSettings,
} from "./services/api";
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
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [shopOpen, setShopOpen] = useState(false);
  const [shopSlidePx, setShopSlidePx] = useState<number | null>(null);
  const [shopDragging, setShopDragging] = useState(false);
  const [showCart, setShowCart] = useState(false);
  const cart = useCart();
  const isDesktop = useMediaQuery("(min-width: 768px)");

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
        const [statusRes, journeyRes, sleepRes, settingsRes] =
          await Promise.all([
            fetchStatus(),
            fetchJourney(),
            fetchSleep(),
            fetchSettings(),
          ]);
        setStatus(statusRes);
        setJourney(journeyRes);
        setSleep(sleepRes);
        setSettings(settingsRes);
      } catch (error) {
        console.error("Failed to load data:", error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  const showMarker = useMemo(() => {
    if (!sleep?.isSleep || !sleep?.isTraveling) return true;
    if (!journey?.currentCity || !(journey as any).nextCity || !settings)
      return true;
    const nextStartIso = (journey as any).nextCity?.lastCurrentAt as any;
    if (!nextStartIso) return true;
    try {
      const nextStart = new Date(nextStartIso);
      const depMinUtc = (settings as any).departureTimeUtc;
      if (typeof depMinUtc !== "number") return true;
      const depHour = Math.floor(depMinUtc / 60);
      const depMin = depMinUtc % 60;
      const dep = new Date(nextStart);
      dep.setUTCHours(depHour, depMin, 0, 0);
      if (dep > nextStart) dep.setUTCDate(dep.getUTCDate() - 1);
      const now = new Date();
      // Compare using UTC-aligned dates
      const nowUtc = new Date(
        Date.UTC(
          now.getUTCFullYear(),
          now.getUTCMonth(),
          now.getUTCDate(),
          now.getUTCHours(),
          now.getUTCMinutes(),
          now.getUTCSeconds(),
          now.getUTCMilliseconds()
        )
      );
      const decision = nowUtc >= dep;
      try {
        console.debug("[TravelDebug] showMarker decision", {
          isSleep: sleep?.isSleep,
          isTraveling: sleep?.isTraveling,
          currentCity: journey?.currentCity
            ? `${journey.currentCity.city}, ${journey.currentCity.state}`
            : null,
          nextCity: (journey as any).nextCity
            ? `${(journey as any).nextCity.city}, ${
                (journey as any).nextCity.state
              }`
            : null,
          nextStartIso,
          nextStartUtc: nextStart.toISOString(),
          departureTimeUtcMin: depMinUtc,
          depUtcISO: dep.toISOString(),
          nowUtcISO: nowUtc.toISOString(),
          decision,
        });
      } catch {}
      return decision;
    } catch {
      return true;
    }
  }, [sleep?.isSleep, sleep?.isTraveling, journey, settings]);

  // Client-side interpolation so the animated marker moves immediately using times
  const travelPos = useMemo(() => {
    if (!sleep?.isSleep || !sleep?.isTraveling) return null;
    const cc = journey?.currentCity as any;
    const nx = (journey as any)?.nextCity as any;
    if (!cc || !nx || !settings) return null;
    const nextStartIso = nx?.lastCurrentAt as any;
    if (!nextStartIso) return null;
    try {
      const nextStart = new Date(nextStartIso);
      const depMinUtc = (settings as any).departureTimeUtc;
      if (typeof depMinUtc !== "number") return null;
      const depHour = Math.floor(depMinUtc / 60);
      const depMin = depMinUtc % 60;
      const dep = new Date(nextStart);
      dep.setUTCHours(depHour, depMin, 0, 0);
      if (dep > nextStart) dep.setUTCDate(dep.getUTCDate() - 1);
      const now = new Date();
      const nowUtc = new Date(
        Date.UTC(
          now.getUTCFullYear(),
          now.getUTCMonth(),
          now.getUTCDate(),
          now.getUTCHours(),
          now.getUTCMinutes(),
          now.getUTCSeconds(),
          now.getUTCMilliseconds()
        )
      );
      const total = (nextStart.getTime() - dep.getTime()) / 1000;
      if (total <= 0) return { lat: nx.lat, lng: nx.lng };
      let f = (nowUtc.getTime() - dep.getTime()) / 1000 / total;
      f = Math.max(0, Math.min(1, f));
      const lat = cc.lat + (nx.lat - cc.lat) * f;
      const lng = cc.lng + (nx.lng - cc.lng) * f;
      try {
        console.debug("[TravelDebug] client interpolation", {
          f,
          depUtcISO: dep.toISOString(),
          nextStartUtc: nextStart.toISOString(),
          nowUtcISO: nowUtc.toISOString(),
          lat,
          lng,
        });
      } catch {}
      return { lat, lng };
    } catch {
      return null;
    }
  }, [sleep?.isSleep, sleep?.isTraveling, journey, settings]);

  // Poll status while sleep traveling to keep marker moving between server updates
  useEffect(() => {
    if (!sleep?.isSleep || !sleep?.isTraveling) return;
    let id: number | undefined;
    const tick = async () => {
      try {
        const s = await fetchStatus();
        setStatus(s);
      } catch {}
    };
    // Initial tick, then poll every 60s (server updates every ~5min)
    tick();
    id = window.setInterval(tick, 60000);
    return () => {
      if (id) window.clearInterval(id);
    };
  }, [sleep?.isSleep, sleep?.isTraveling]);

  if (loading) {
    return <div className="app loading">Loading...</div>;
  }

  if (!status || !journey || !sleep || !settings) {
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
            zIndex: 2000,
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
          zIndex: !isDesktop && shopOpen ? 1400 : 2000,
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
            width: "100%",
            height: "100%",
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
          <Icon name="question-mark" size={28} preserveColors />
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
          zIndex: 1500,
        }}
      >
        <Header />
        <Quote quote={status.quote} />
      </div>

      <div className="map-container">
        <FlatMap
          lat={
            sleep.isSleep && sleep.isTraveling && travelPos
              ? travelPos.lat
              : journey.currentCity?.lat || status.lat
          }
          lng={
            sleep.isSleep && sleep.isTraveling && travelPos
              ? travelPos.lng
              : journey.currentCity?.lng || status.lng
          }
          state={journey.currentCity?.state || status.state}
          path={memoPath}
          pastCities={journey.path}
          isSleep={sleep.isSleep}
          isTraveling={!!sleep.isTraveling}
          currentCity={journey.currentCity || null}
          showMarker={showMarker}
        />

        {/* Removed sleep overlay per user request */}
      </div>

      {/* Footer overlay */}
      <Footer />

      {/* Shop UI */}
      {!settings.disableMerch && (
        <>
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
        </>
      )}
    </div>
  );
}

export default App;
