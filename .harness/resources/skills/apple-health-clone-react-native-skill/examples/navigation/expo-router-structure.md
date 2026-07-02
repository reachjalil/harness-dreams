# Expo Router Structure

Suggested app structure:

```text
app/
  _layout.tsx                 # root stack
  (tabs)/
    _layout.tsx               # native tabs or standard tabs
    index.tsx                 # Summary
    browse.tsx                # Browse categories
    awards.tsx                # Awards
    sharing.tsx               # Sources/permissions/export
  metrics/
    [metricId].tsx            # Metric detail
  goals/
    [goalId].tsx              # Goal edit/detail
  badges/
    [badgeId].tsx             # Badge detail
  permissions/
    health.tsx                # HealthKit explainer before system sheet
  settings.tsx
```

Top-level navigation should feel native:

- Summary uses a large title.
- Metric detail uses push navigation.
- Goal editing can use a sheet/modal.
- Permission explainer should be custom UI followed by the system HealthKit sheet.
- Awards detail can be a push or sheet depending on depth.

Avoid custom navigation where native platform navigation gives you the desired feel.
