# 130 — Testing and Quality Checklist

## Device matrix

Test on:

- iPhone with HealthKit data.
- iPhone with no HealthKit data.
- iPhone where user denies some permissions.
- Apple Watch paired and reachable.
- Apple Watch paired but unreachable.
- Apple Watch offline then reconnecting.
- Dark mode.
- Large Dynamic Type.
- VoiceOver.
- Reduced Motion.
- Low Power Mode.

## HealthKit tests

- App handles HealthKit unavailable.
- App handles partial permission grant.
- App handles denied permission without looping prompts.
- Read queries return expected date ranges.
- Units are correct.
- Time zones do not break daily aggregation.
- Duplicate phone/watch samples are not double counted.
- Background delivery refreshes the right range.
- Foreground refresh reconciles missed events.

## Ring tests

- 0%, 1%, 50%, 99%, 100%, 101%, 150%, 250%.
- Very small size.
- Watch size.
- Large text label layout.
- Reduced Motion.
- Color-blind safe labels.
- Right-to-left layout if localized.

## Badge tests

- First badge earned once.
- Streak increments correctly.
- Streak pause rules work.
- Time zone changes do not break streaks.
- Monthly challenge is achievable.
- Recomputing history produces same earned badge list.

## Recommendation tests

- No insight with low sample count unless marked low confidence.
- No diagnostic language.
- Suggestions are specific and achievable.
- Dismissed insight does not immediately reappear.
- Evidence values match chart data.

## Watch tests

- Application context updates display state.
- Send message works when reachable.
- User info transfer queues when unreachable.
- Schema mismatch is ignored safely.
- Watch app renders last-known snapshot.
- Watch action reconciles after phone reconnect.

## Design tests

- Cards readable in dark/light mode.
- 44x44 pt minimum touch target.
- Text does not truncate important units.
- Chart labels accessible.
- Empty states explain next action.
- Apple-owned assets are not bundled.

## Privacy tests

- Health data not logged.
- Crash reports redacted.
- AI calls use aggregates where possible.
- Export/delete path works.
- Permission copy matches actual requested types.
- Privacy policy matches implementation.
