import { type ReactElement, useState } from "react";

import Lab from "./Lab";
import Onboarding from "./Onboarding";
import Settings from "./Settings";
import Today from "./Today";
import { useHarnessDreams } from "./useHarnessDreams";

type Tab = "today" | "lab" | "settings";

const TABS: { value: Tab; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "lab", label: "Lab" },
  { value: "settings", label: "Settings" },
];

function Loading(): ReactElement {
  return (
    <div className="app">
      <div className="titlebar" />
      <div className="scroll">
        <p className="card-hint">Loading…</p>
      </div>
    </div>
  );
}

function MainShell({
  hd,
}: {
  hd: ReturnType<typeof useHarnessDreams>;
}): ReactElement {
  const [tab, setTab] = useState<Tab>("today");
  const unreviewed = hd.state?.hasUnreviewed ?? false;

  return (
    <div className="app">
      <div className="titlebar" />
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark" />
          <div>
            <h1>Harness Dreams</h1>
            <p>Your harness health app</p>
          </div>
        </div>
        <div className="tabs" role="tablist">
          {TABS.map((t) => (
            <button
              key={t.value}
              type="button"
              role="tab"
              aria-selected={tab === t.value}
              className={`tab${tab === t.value ? " active" : ""}`}
              onClick={() => setTab(t.value)}
            >
              {t.label}
              {t.value === "today" && unreviewed ? (
                <span className="tab-badge" />
              ) : null}
            </button>
          ))}
        </div>
      </header>

      <div className="scroll">
        {tab === "today" ? <Today hd={hd} /> : null}
        {tab === "lab" ? <Lab hd={hd} /> : null}
        {tab === "settings" ? <Settings hd={hd} /> : null}
      </div>
    </div>
  );
}

export default function App(): ReactElement {
  const hd = useHarnessDreams();

  if (!hd.config) return <Loading />;
  if (!hd.config.onboarded) return <Onboarding hd={hd} />;
  return <MainShell hd={hd} />;
}
