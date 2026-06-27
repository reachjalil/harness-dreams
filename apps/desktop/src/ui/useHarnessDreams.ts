import { useCallback, useEffect, useState } from "react";

import type { ConfigPatch } from "../shared/schemas";
import type { AppConfig, DreamReport, RuntimeState } from "../shared/types";

export interface HarnessDreams {
  config: AppConfig | null;
  state: RuntimeState | null;
  report: DreamReport | null;
  patch: (patch: ConfigPatch) => void;
  actions: Window["hd"]["actions"];
}

/** Subscribes the UI to live config/state from main, plus the (mock) report. */
export function useHarnessDreams(): HarnessDreams {
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [state, setState] = useState<RuntimeState | null>(null);
  const [report, setReport] = useState<DreamReport | null>(null);

  useEffect(() => {
    let active = true;
    void window.hd.config.get().then((c) => active && setConfig(c));
    void window.hd.state.get().then((s) => active && setState(s));
    void window.hd.report.get().then((r) => active && setReport(r));

    const unsubs = [
      window.hd.events.onConfig(setConfig),
      window.hd.events.onState(setState),
    ];
    return () => {
      active = false;
      for (const unsub of unsubs) unsub();
    };
  }, []);

  const patch = useCallback((next: ConfigPatch) => {
    void window.hd.config.set(next).then(setConfig);
  }, []);

  return { config, state, report, patch, actions: window.hd.actions };
}
