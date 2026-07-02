# 80 — Apple Watch Companion Patterns

The watch app should be native Swift/SwiftUI and communicate with the React Native iPhone app through WatchConnectivity.

## Watch role

The Watch app should do fewer things than the phone app:

- Show today’s rings.
- Show the next action.
- Log a simple event.
- Start/stop workouts if relevant.
- Show a small achievement notification.
- Sync compact state back to the phone.

Do not reproduce the entire iPhone app on the Watch.

## Architecture

```text
React Native iPhone app
  ├─ computes rings, badges, recommendations
  ├─ persists data locally
  └─ sends compact DailySnapshot to Watch

SwiftUI Watch app
  ├─ stores latest DailySnapshot
  ├─ renders glanceable rings/cards
  ├─ sends user actions to iPhone
  └─ optionally reads native HealthKit/workout data when needed
```

## Daily snapshot contract

```ts
export interface WatchDailySnapshot {
  schemaVersion: 1;
  generatedAt: string;
  date: string;
  rings: Array<{
    id: string;
    label: string;
    value: number;
    goal: number;
    unit: string;
    progress: number;
    colorHex: string;
  }>;
  nextAction?: {
    id: string;
    title: string;
    action: 'open-phone' | 'log-event' | 'start-workout' | 'adjust-goal';
  };
  latestAward?: {
    id: string;
    title: string;
    earnedAt: string;
  };
}
```

## Watch screens

### Rings glance

- Three-ring cluster or one large ring.
- Current values.
- “Keep going” or “All closed” short copy.

### Goal detail

- Ring detail.
- Today’s progress.
- One action button.

### Log action

- Big tap targets.
- Confirmation haptic.
- Undo path if possible.

### Awards

- Recent award only.
- Avoid a huge badge library on watch.

### Workout state

- Start / pause / resume / end.
- Heart rate and elapsed time only if relevant.
- Sync with HealthKit and phone state carefully.

## WatchConnectivity channels

Use the right channel:

| Channel | Use for |
| --- | --- |
| Application context | Latest daily snapshot; replace old state |
| Send message | Immediate user action when reachable |
| User info transfer | Guaranteed queued facts/events |
| File transfer | Larger exports or debug logs |

## Sync rules

- Watch should render last known snapshot if phone is unreachable.
- Phone should reconcile any queued watch actions on reconnect.
- Use schema versions in every payload.
- Keep payloads small.
- Treat WatchConnectivity as eventual, not always real-time.

## Native HealthKit on Watch

For workout apps, the watch may need to own parts of workout/session state natively. In that case:

- Keep workout session state native.
- Send summaries to RN phone app.
- Avoid requiring phone reachability during an active workout.
- Reconcile after workout completion.

## Haptics

Use haptics sparingly:

- goal complete.
- workout started/stopped.
- log confirmed.
- award earned.

Respect user settings.
