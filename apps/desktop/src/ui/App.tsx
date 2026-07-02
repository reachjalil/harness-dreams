import { type ReactElement, useEffect, useState } from "react";

import Browse from "./Browse";
import Chat from "./Chat";
import { CloudSyncDialog } from "./CloudSyncDialog";
import ConfigUpdates from "./ConfigUpdates";
import { PageBoundary } from "./ErrorBoundary";
import Review from "./Review";
import { alignmentSplit, band, Sidebar, type Tab } from "./components";
import Lab from "./Lab";
import Onboarding from "./Onboarding";
import Settings from "./Settings";
import Today from "./Today";
import { type HarnessHealth, useHarnessHealth } from "./useHarnessHealth";

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

const VALID_TABS = new Set<Tab>([
  "today",
  "browse",
  "review",
  "lab",
  "config",
  "chat",
  "settings",
]);

function initialTab(): Tab {
  const tab = new URLSearchParams(window.location.search).get("tab");
  return tab && VALID_TABS.has(tab as Tab) ? (tab as Tab) : "today";
}

function MainShell({ hd }: { hd: HarnessHealth }): ReactElement {
  const [tab, setTab] = useState<Tab>(initialTab);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [cloudSyncOpen, setCloudSyncOpen] = useState(false);
  const unreviewedReport =
    hd.reports[0]?.reviewStatus === "unreviewed" ? hd.reports[0] : undefined;
  const unreviewed = unreviewedReport ? 1 : 0;
  const latestReviewed =
    hd.reports.find((report) => report.reviewStatus === "reviewed") ??
    hd.reports[0] ??
    null;

  // The tray's "Recent sessions" submenu can ask us to open a specific review.
  useEffect(() => {
    if (!window.hd) return;
    return window.hd.events.onSelectReport((id) => {
      setSelectedId(id);
      setTab("review");
    });
  }, []);

  const selected = selectedId
    ? (hd.reports.find((r) => r.id === selectedId) ?? null)
    : null;
  const reportForProgress = latestReviewed;
  const phase = hd.state?.phase ?? "idle";
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
    if (next === "review") setSelectedId(null);
  }

  function selectReview(id: string): void {
    setSelectedId(id);
    setTab("review");
  }

  function runHealthReview(): void {
    setSelectedId(null);
    setTab("review");
    void hd.actions.runHealthReview();
  }

  function runQuickReview(): void {
    setSelectedId(null);
    setTab("review");
    void hd.actions.runQuickReview();
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
        lastReviewAt={hd.state?.lastReviewAt ?? null}
        unreviewed={unreviewed || (hd.state?.hasUnreviewed ? 1 : 0)}
        onUpgrade={() => setCloudSyncOpen(true)}
      />

      <main className="workspace">
        <div className={`scroll${tab === "today" ? " scroll-dash" : ""}`}>
          <div
            className={`scroll-inner${tab === "today" ? " scroll-inner-dash" : ""}`}
          >
            {tab === "today" ? (
              <PageBoundary name="Today">
                <Today
                  hd={hd}
                  report={reportForProgress}
                  pendingReview={unreviewedReport ?? null}
                  onOpenGoals={() => setTab("lab")}
                  onRunHealthReview={runHealthReview}
                  onRunQuickReview={runQuickReview}
                  onOpenReview={() => {
                    if (hd.reports[0]) selectReview(hd.reports[0].id);
                    else navigate("review");
                  }}
                />
              </PageBoundary>
            ) : null}
            {tab === "browse" ? (
              <PageBoundary name="Browse">
                <Browse hd={hd} report={reportForProgress} />
              </PageBoundary>
            ) : null}
            {tab === "review" ? (
              <PageBoundary name="Review">
                <Review
                  hd={hd}
                  report={selected}
                  reports={hd.reports}
                  selectedId={selectedId}
                  onSelectReview={selectReview}
                  onBackToList={() => setSelectedId(null)}
                  onOpenImprovements={() => setTab("lab")}
                  onRunHealthReview={runHealthReview}
                />
              </PageBoundary>
            ) : null}
            {tab === "lab" ? (
              <PageBoundary name="Lab">
                <Lab hd={hd} report={reportForProgress} />
              </PageBoundary>
            ) : null}
            {tab === "config" ? (
              <PageBoundary name="Config Updates">
                <ConfigUpdates hd={hd} reports={hd.reports} />
              </PageBoundary>
            ) : null}
            {tab === "chat" ? (
              <PageBoundary name="Chat">
                <Chat />
              </PageBoundary>
            ) : null}
            {tab === "settings" ? (
              <PageBoundary name="Settings">
                <Settings hd={hd} onRunHealthReview={runHealthReview} />
              </PageBoundary>
            ) : null}
          </div>
        </div>
      </main>

      <CloudSyncDialog
        open={cloudSyncOpen}
        onClose={() => setCloudSyncOpen(false)}
      />
    </div>
  );
}

export default function App(): ReactElement {
  const hd = useHarnessHealth();
  const reduceMotion = hd.config?.reduceMotion ?? false;

  useEffect(() => {
    document.body.classList.toggle("reduce-motion", reduceMotion);
  }, [reduceMotion]);

  if (!hd.config) return <Loading />;
  if (!hd.config.onboarded) return <Onboarding hd={hd} />;
  return <MainShell hd={hd} />;
}
