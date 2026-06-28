import { type ReactElement, type ReactNode, useEffect, useRef } from "react";

import {
  CLOUD_SYNC_BENEFITS,
  CLOUD_SYNC_FOOTNOTE,
  CLOUD_SYNC_TAGLINE,
} from "./cloudSync";
import { Button, Pill } from "./components";
import { Icon } from "./icons";

/**
 * A minimal, solid (non-glass) modal: a dim scrim with a centered opaque panel.
 * Escape and a click outside the panel close it; focus moves to the panel on
 * open. The backdrop is a real <button> so dismissal is keyboard-accessible,
 * not a click-only div. There is no portal — it renders inline at the app root,
 * above the titlebar.
 */
function Modal({
  open,
  onClose,
  labelledBy,
  children,
}: {
  open: boolean;
  onClose: () => void;
  labelledBy: string;
  children: ReactNode;
}): ReactElement | null {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent): void {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    panelRef.current?.focus();
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="modal-scrim">
      <button
        type="button"
        className="modal-backdrop"
        aria-label="Close"
        onClick={onClose}
      />
      <div
        ref={panelRef}
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        tabIndex={-1}
      >
        {children}
      </div>
    </div>
  );
}

/**
 * The always-reachable Cloud Sync dialog. Explains the promise — sync the cycle
 * signal to MongoDB Atlas for phone/watch clients, while code stays local — and
 * routes setup to Settings.
 */
export function CloudSyncDialog({
  open,
  onClose,
  enabled,
  onOpenSettings,
}: {
  open: boolean;
  onClose: () => void;
  enabled: boolean;
  onOpenSettings: () => void;
}): ReactElement {
  return (
    <Modal open={open} onClose={onClose} labelledBy="cloudsync-title">
      <button
        type="button"
        className="modal-close"
        onClick={onClose}
        aria-label="Close"
      >
        <span aria-hidden="true">×</span>
      </button>

      <div className="cloudsync">
        <div className="cloudsync-head">
          <span className="cloudsync-mark">
            <Icon name="cloudsync" size={22} />
          </span>
          <div className="cloudsync-head-text">
            <div className="cloudsync-eyebrow">MongoDB Atlas</div>
            <h2 id="cloudsync-title" className="cloudsync-title">
              Cloud Sync
            </h2>
          </div>
          <span className="cloudsync-price">
            <Icon name="sync" size={18} />
            <span>{enabled ? "On" : "Setup"}</span>
          </span>
        </div>

        <p className="cloudsync-lede">{CLOUD_SYNC_TAGLINE}</p>

        <div className="cloudsync-soon">
          <Pill tone={enabled ? "good" : "accent"}>
            {enabled ? "Enabled" : "Self-hosted"}
          </Pill>
          <span>
            Add your Atlas URI and shared user id in Settings. The desktop keeps
            syncing whenever it can connect.
          </span>
        </div>

        <ul className="cloudsync-benefits">
          {CLOUD_SYNC_BENEFITS.map((benefit) => (
            <li key={benefit.title}>
              <span className="cloudsync-benefit-icon">
                <Icon name={benefit.icon} size={18} />
              </span>
              <div>
                <div className="cloudsync-benefit-title">{benefit.title}</div>
                <p className="cloudsync-benefit-body">{benefit.body}</p>
              </div>
            </li>
          ))}
        </ul>

        <p className="cloudsync-footnote">{CLOUD_SYNC_FOOTNOTE}</p>

        <div className="cloudsync-actions">
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
          <Button variant="accent" onClick={onOpenSettings}>
            <Icon name="settings" size={15} />
            Open Settings
          </Button>
        </div>
      </div>
    </Modal>
  );
}
