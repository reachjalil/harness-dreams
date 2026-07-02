# 110 — Privacy, Compliance, and Apple Brand Safety

Health data is sensitive. Build privacy into the product flow.

## HealthKit privacy rules

- Ask only for data types needed for the feature.
- Explain the benefit before showing the system permission sheet.
- Handle partial grants.
- Let users continue without connecting HealthKit where possible.
- Make permission status visible.
- Never sell health data.
- Do not use health data for advertising or unrelated profiling.
- Avoid uploading raw health data unless clearly needed and consented.

## App review readiness

Prepare answers for:

- What HealthKit types do you request?
- Why does the app need each type?
- What does the app write to HealthKit?
- Can the user revoke access?
- Is there a delete/export path for app-owned data?
- Are insights medical or wellness?
- Is any data sent to a backend or AI service?

## Apple brand guidance

You can say your app works with the Apple Health app if it does and if you follow Apple’s guidelines.

Do not:

- Say “Apple Health data” as if Apple owns user data.
- Use the Apple logo alone.
- Alter the Works with Apple Health badge.
- Use Apple product imagery or badge art in unapproved ways.
- Copy the Health or Fitness app icon.
- Create UI that implies your app is made by Apple.

## Copy guidance

Preferred:

```text
Connect to the Health app to import your step and workout data.
```

Avoid:

```text
Sync your Apple Health data into our AI.
```

Preferred:

```text
Your data stays on this device unless you turn on cloud sync.
```

Avoid:

```text
We keep your data safe.
```

Be specific.

## AI / recommendation privacy

If using AI:

- Prefer aggregate values over raw samples.
- Remove unnecessary identifiers.
- Show what data is used.
- Provide opt-out.
- Keep medical disclaimers clear.
- Do not generate diagnosis or treatment instructions without clinical review.

## Security checklist

- Encrypt local sensitive data where appropriate.
- Use secure storage for tokens.
- Avoid logging health samples.
- Redact debug reports.
- Use least-privilege backend access.
- Provide export/delete.
- Document data retention.

## Sensitive UI

Some metrics require extra care:

- reproductive health.
- mental wellbeing.
- medications.
- symptoms.
- diagnoses/clinical records.
- location-linked workouts.

Use neutral labels, privacy-preserving notifications, and lock-screen-safe summaries.
