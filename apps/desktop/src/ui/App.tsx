import { type ReactElement, useEffect, useState } from "react";

import { CloudSyncDialog } from "./CloudSyncDialog";
import Cycle from "./Cycle";
import { alignmentSplit, band, Sidebar, type Tab } from "./components";
import Lab from "./Lab";
import Onboarding from "./Onboarding";
import Settings from "./Settings";
import Today from "./Today";
import { type HarnessDreams, useHarnessDreams } from "./useHarnessDreams";

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

function MainShell({ hd }: { hd: HarnessDreams }): ReactElement {
  const [tab, setTab] = useState<Tab>("today");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [cloudSyncOpen, setCloudSyncOpen] = useState(false);
  const unreviewedCycle =
    hd.reports[0]?.reviewStatus === "unreviewed" ? hd.reports[0] : undefined;
  const unreviewed = unreviewedCycle ? 1 : 0;
  const latestReviewed =
    hd.reports.find((report) => report.reviewStatus === "reviewed") ??
    hd.reports[0] ??
    null;

  // The tray's "Recent sessions" submenu can ask us to open a specific dream.
  useEffect(() => {
    if (!window.hd) return;
    return window.hd.events.onSelectReport((id) => {
      setSelectedId(id);
      setTab("cycle");
    });
  }, []);

  const selected = selectedId
    ? (hd.reports.find((r) => r.id === selectedId) ?? null)
    : null;
  const reportForProgress = latestReviewed;
  const phase = hd.state?.phase ?? "resting";
  const split = reportForProgress
    ? alignmentSplit(reportForProgress)
    : { human: 0, agent: 0, band: band(0) };
  const alignmentScore = reportForProgress
    ? (reportForProgress.alignment?.score ??
      reportForProgress.rings.find((r) => r.key === "alignment")?.score ??
      0)
    : 0;

  function navigate(next: Tab): void {
    setTab(next);
    if (next === "cycle") setSelectedId(null);
  }

  function selectCycle(id: string): void {
    setSelectedId(id);
    setTab("cycle");
  }

  function runSleepCycle(): void {
    setSelectedId(null);
    setTab("cycle");
    void hd.actions.dreamNow();
  }

  return (
    <div className="app shell">
      <div className="titlebar" />

      <Sidebar
        active={tab}
        onNavigate={navigate}
        alignment={alignmentScore}
        band={split.band}
        phase={phase}
        lastDreamAt={hd.state?.lastDreamAt ?? null}
        unreviewed={unreviewed || (hd.state?.hasUnreviewed ? 1 : 0)}
        onUpgrade={() => setCloudSyncOpen(true)}
      />

      <main className="workspace">
        <div className={`scroll${tab === "today" ? " scroll-dash" : ""}`}>
          <div
            className={`scroll-inner${tab === "today" ? " scroll-inner-dash" : ""}`}
          >
            {tab === "today" ? (
              <Today
                hd={hd}
                report={reportForProgress}
                pendingCycle={unreviewedCycle ?? null}
                onOpenGoals={() => setTab("lab")}
                onRunSleepCycle={runSleepCycle}
                onOpenCycle={() => {
                  if (hd.reports[0]) selectCycle(hd.reports[0].id);
                  else navigate("cycle");
                }}
              />
            ) : null}
            {tab === "cycle" ? (
              <Cycle
                hd={hd}
                report={selected}
                reports={hd.reports}
                selectedId={selectedId}
                onSelectCycle={selectCycle}
                onBackToList={() => setSelectedId(null)}
                onOpenImprovements={() => setTab("lab")}
                onRunSleepCycle={runSleepCycle}
              />
            ) : null}
            {tab === "lab" ? <Lab report={reportForProgress} /> : null}
            {tab === "settings" ? (
              <Settings hd={hd} onRunSleepCycle={runSleepCycle} />
            ) : null}
          </div>
        </div>
      </main>

      <CloudSyncDialog
        open={cloudSyncOpen}
        onClose={() => setCloudSyncOpen(false)}
        interested={hd.config?.cloudSyncInterest ?? false}
        onNotify={() => hd.patch({ cloudSyncInterest: true })}
      />
    </div>
  );
}

export default function App(): ReactElement {
  const hd = useHarnessDreams();
  const reduceMotion = hd.config?.reduceMotion ?? false;

  useEffect(() => {
    document.body.classList.toggle("reduce-motion", reduceMotion);
  }, [reduceMotion]);

  if (!hd.config) return <Loading />;
  if (!hd.config.onboarded) return <Onboarding hd={hd} />;
  return <MainShell hd={hd} />;
}
