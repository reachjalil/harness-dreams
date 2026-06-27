import { type ReactElement, useState } from "react";

import type { PrivacyMode, ScheduleMode } from "../shared/types";
import { BrandMark, Button } from "./components";
import type { HarnessDreams } from "./useHarnessDreams";

const PRIVACY_OPTIONS: { value: PrivacyMode; title: string; sub: string }[] = [
  {
    value: "local",
    title: "Local-only",
    sub: "Everything stays on your Mac. Vitals & trends, no cloud.",
  },
  {
    value: "cloud",
    title: "Cloud analysis (opt-in)",
    sub: "Send redacted excerpts for richer insights. You can preview redaction first.",
  },
];

const SCHEDULE_OPTIONS: { value: ScheduleMode; title: string; sub: string }[] =
  [
    {
      value: "nightly",
      title: "Every night",
      sub: "Dream automatically at 3:00 AM when your harness is idle.",
    },
    {
      value: "manual",
      title: "Only when I ask",
      sub: "No automatic dreams — start one from the menu bar anytime.",
    },
  ];

export default function Onboarding({
  hd,
}: {
  hd: HarnessDreams;
}): ReactElement {
  const { actions, patch } = hd;
  const [step, setStep] = useState(0);
  const [privacy, setPrivacy] = useState<PrivacyMode>("local");
  const [schedule, setSchedule] = useState<ScheduleMode>("nightly");
  const lastStep = 3;

  function finish(): void {
    patch({ privacyMode: privacy, schedule: { mode: schedule } });
    void actions.completeOnboarding();
  }

  function next(): void {
    if (step >= lastStep) finish();
    else setStep(step + 1);
  }

  return (
    <div className="onb">
      <div className="titlebar" />
      <div className="onb-body">
        {step === 0 ? (
          <>
            <div className="onb-mark-wrap">
              <BrandMark size={66} />
            </div>
            <h2>Harness Dreams</h2>
            <p>
              Your harness health app. While your coding tools sleep, Harness
              Dreams reflects on the day — so you wake up a little sharper than
              you went to bed.
            </p>
          </>
        ) : null}

        {step === 1 ? (
          <>
            <h2>While you sleep, it works</h2>
            <p>One quiet loop, every day.</p>
            <ul className="onb-list">
              <li>
                <span className="num">1</span>
                <div>
                  <b>Sleep.</b> Your harness writes a full diary of the day.
                </div>
              </li>
              <li>
                <span className="num">2</span>
                <div>
                  <b>Dream.</b> Overnight, it reviews sessions, finds patterns,
                  and grades experiments.
                </div>
              </li>
              <li>
                <span className="num">3</span>
                <div>
                  <b>Reflect.</b> Each morning, a health report — accept
                  findings, run experiments.
                </div>
              </li>
            </ul>
          </>
        ) : null}

        {step === 2 ? (
          <>
            <h2>Private by design</h2>
            <p>
              Your transcripts hold code and secrets. You choose what leaves.
            </p>
            <div className="choices">
              {PRIVACY_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={`choice${privacy === option.value ? " selected" : ""}`}
                  onClick={() => setPrivacy(option.value)}
                >
                  <div className="choice-title">{option.title}</div>
                  <div className="choice-sub">{option.sub}</div>
                </button>
              ))}
            </div>
          </>
        ) : null}

        {step === 3 ? (
          <>
            <h2>When should it dream?</h2>
            <p>You can change this anytime in Settings.</p>
            <div className="choices">
              {SCHEDULE_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={`choice${schedule === option.value ? " selected" : ""}`}
                  onClick={() => setSchedule(option.value)}
                >
                  <div className="choice-title">{option.title}</div>
                  <div className="choice-sub">{option.sub}</div>
                </button>
              ))}
            </div>
          </>
        ) : null}
      </div>

      <div className="onb-foot">
        <div className="dots">
          {[0, 1, 2, 3].map((index) => (
            <span key={index} className={index === step ? "active" : ""} />
          ))}
        </div>
        {step > 0 ? (
          <Button variant="ghost" onClick={() => setStep(step - 1)}>
            Back
          </Button>
        ) : null}
        <Button variant="accent" onClick={next}>
          {step >= lastStep ? "Enter Harness Dreams" : "Continue"}
        </Button>
      </div>
    </div>
  );
}
