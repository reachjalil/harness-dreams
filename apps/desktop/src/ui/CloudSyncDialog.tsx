import { type ReactElement, type ReactNode, useEffect, useRef } from "react";

import { Button, Pill } from "./components";
import { Icon, type IconName } from "./icons";

interface CloudSyncPlan {
  icon: IconName;
  name: string;
  price: string;
  cadence: string;
  status: string;
  statusTone: "neutral" | "accent";
  description: string;
  features: string[];
  featured?: boolean;
}

const CLOUD_SYNC_PLANS: CloudSyncPlan[] = [
  {
    icon: "privacy",
    name: "Local Only",
    price: "Free",
    cadence: "forever",
    status: "Always free",
    statusTone: "neutral",
    description:
      "Private harness health on this Mac, with local reports, projects, and learning.",
    features: ["No account", "No cloud sync", "Code and secrets stay local"],
  },
  {
    icon: "cloudsync",
    name: "Sync",
    price: "$5",
    cadence: "per month",
    status: "Coming soon",
    statusTone: "accent",
    description:
      "Sync your harness health, projects, and learning across your own devices.",
    features: [
      "Mac, iPhone, and Apple Watch",
      "Cross-device learning",
      "Personal project sync",
    ],
    featured: true,
  },
  {
    icon: "human",
    name: "Team Sync",
    price: "$10",
    cadence: "per member / month",
    status: "Coming soon",
    statusTone: "accent",
    description:
      "Shared collaboration and team learning, with projects synced across the team.",
    features: [
      "Team project sync",
      "Shared learning loops",
      "Collaborative improvements",
    ],
  },
];

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
  className,
  children,
}: {
  open: boolean;
  onClose: () => void;
  labelledBy: string;
  className?: string;
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
        className={`modal${className ? ` ${className}` : ""}`}
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

/** The always-reachable Cloud Sync upgrade dialog. */
export function CloudSyncDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}): ReactElement {
  return (
    <Modal
      open={open}
      onClose={onClose}
      labelledBy="cloudsync-title"
      className="cloudsync-modal"
    >
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
            <div className="cloudsync-eyebrow">Harness Dreams</div>
            <h2 id="cloudsync-title" className="cloudsync-title">
              Upgrade Sync
            </h2>
          </div>
          <span className="cloudsync-price">
            <Icon name="sync" size={18} />
            <span>Coming soon</span>
          </span>
        </div>

        <p className="cloudsync-lede">
          Start local for free, add personal sync for $5 a month, or bring a
          team into shared projects and learning for $10 per member.
        </p>

        <div
          className="cloudsync-plans"
          role="list"
          aria-label="Cloud Sync plans"
        >
          {CLOUD_SYNC_PLANS.map((plan) => (
            <article
              key={plan.name}
              className={`cloudsync-plan${plan.featured ? " featured" : ""}`}
              role="listitem"
            >
              <div className="cloudsync-plan-head">
                <span className="cloudsync-plan-icon">
                  <Icon name={plan.icon} size={18} />
                </span>
                <Pill tone={plan.statusTone}>{plan.status}</Pill>
              </div>
              <h3 className="cloudsync-plan-name">{plan.name}</h3>
              <div className="cloudsync-plan-price">
                <b>{plan.price}</b>
                <span>{plan.cadence}</span>
              </div>
              <p className="cloudsync-plan-description">{plan.description}</p>
              <ul className="cloudsync-plan-features">
                {plan.features.map((feature) => (
                  <li key={feature}>
                    <Icon name="accept" size={14} />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>

        <p className="cloudsync-footnote">
          Code, transcripts, repo paths, patch snippets, and secrets stay local
          on every plan.
        </p>

        <div className="cloudsync-actions">
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </Modal>
  );
}
