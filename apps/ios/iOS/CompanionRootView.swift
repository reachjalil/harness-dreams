import SwiftUI

struct CompanionRootView: View {
    @EnvironmentObject private var store: HarnessDreamsSignalStore

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 20) {
                    HeroSummary(snapshot: store.snapshot)
                    RingRow(rings: store.snapshot.rings)
                    MetricGrid(metrics: store.snapshot.metrics)
                    FindingList(findings: store.snapshot.findings)
                    GoalList(goals: store.snapshot.goals)
                    PrivacyBand()
                }
                .padding(20)
            }
            .background(Color(.systemGroupedBackground))
            .navigationTitle("Harness Dreams")
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        store.refreshFromDesktopSignal()
                    } label: {
                        Label("Sync", systemImage: "arrow.clockwise")
                    }
                }
            }
        }
    }
}

private struct HeroSummary: View {
    let snapshot: DreamSignalSnapshot

    var body: some View {
        VStack(alignment: .leading, spacing: 18) {
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: 6) {
                    Text(snapshot.rangeLabel)
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(.secondary)
                    Text("Harness health")
                        .font(.largeTitle.weight(.bold))
                    Text(snapshot.harness)
                        .font(.callout)
                        .foregroundStyle(.secondary)
                }

                Spacer()

                CompositeBadge(score: snapshot.compositeScore)
            }

            Text(snapshot.digest)
                .font(.body)
                .foregroundStyle(.primary)
                .fixedSize(horizontal: false, vertical: true)

            HStack(spacing: 12) {
                Label("\(snapshot.sessions) sessions", systemImage: "text.bubble")
                Label("\(snapshot.projects) projects", systemImage: "folder")
            }
            .font(.footnote.weight(.semibold))
            .foregroundStyle(.secondary)

            HStack(spacing: 6) {
                Image(systemName: "icloud.and.arrow.down")
                    .foregroundStyle(.teal)
                Text("Last synced \(snapshot.lastSyncedAt.formatted(date: .omitted, time: .shortened))")
                    .foregroundStyle(.secondary)
            }
            .font(.footnote)
        }
        .padding(18)
        .background(.background)
        .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
    }
}

private struct CompositeBadge: View {
    let score: Int

    var body: some View {
        ZStack {
            Circle()
                .stroke(Color.teal.opacity(0.18), lineWidth: 10)
            Circle()
                .trim(from: 0, to: CGFloat(score) / 100)
                .stroke(
                    AngularGradient(
                        colors: [.teal, .blue, .green, .teal],
                        center: .center
                    ),
                    style: StrokeStyle(lineWidth: 10, lineCap: .round)
                )
                .rotationEffect(.degrees(-90))
            VStack(spacing: 1) {
                Text("\(score)")
                    .font(.title2.weight(.bold))
                Text("score")
                    .font(.caption2.weight(.semibold))
                    .foregroundStyle(.secondary)
            }
        }
        .frame(width: 82, height: 82)
        .accessibilityLabel("Composite score \(score)")
    }
}

private struct RingRow: View {
    let rings: [DreamRing]

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            SectionHeader(title: "Today", systemImage: "chart.line.uptrend.xyaxis")

            HStack(spacing: 12) {
                ForEach(rings) { ring in
                    RingTile(ring: ring)
                }
            }
        }
    }
}

private struct RingTile: View {
    let ring: DreamRing

    var body: some View {
        VStack(spacing: 10) {
            ZStack {
                Circle()
                    .stroke(ringColor.opacity(0.18), lineWidth: 8)
                Circle()
                    .trim(from: 0, to: CGFloat(ring.score) / 100)
                    .stroke(ringColor, style: StrokeStyle(lineWidth: 8, lineCap: .round))
                    .rotationEffect(.degrees(-90))
                Text("\(ring.score)")
                    .font(.headline.weight(.bold))
            }
            .frame(width: 58, height: 58)

            VStack(spacing: 2) {
                Text(ring.label)
                    .font(.caption.weight(.semibold))
                    .lineLimit(1)
                    .minimumScaleFactor(0.8)
                Text(deltaText)
                    .font(.caption2.weight(.semibold))
                    .foregroundStyle(ring.delta >= 0 ? .green : .orange)
            }
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 14)
        .padding(.horizontal, 8)
        .background(.background)
        .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
        .accessibilityElement(children: .combine)
    }

    private var ringColor: Color {
        switch ring.key {
        case .efficiency:
            return .teal
        case .effectiveness:
            return .blue
        case .alignment:
            return .green
        }
    }

    private var deltaText: String {
        ring.delta >= 0 ? "+\(ring.delta)" : "\(ring.delta)"
    }
}

private struct MetricGrid: View {
    let metrics: [DreamMetric]

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            SectionHeader(title: "Metrics", systemImage: "waveform.path.ecg")

            LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 12) {
                ForEach(metrics) { metric in
                    MetricTile(metric: metric)
                }
            }
        }
    }
}

private struct MetricTile: View {
    let metric: DreamMetric

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text(metric.label)
                    .font(.footnote.weight(.semibold))
                    .foregroundStyle(.secondary)
                Spacer()
                Image(systemName: symbolName)
                    .font(.caption.weight(.bold))
                    .foregroundStyle(metric.good ? .green : .orange)
            }

            Text(metric.value)
                .font(.title3.weight(.bold))

            Text(deltaText)
                .font(.caption.weight(.semibold))
                .foregroundStyle(metric.good ? .green : .orange)
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(.background)
        .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
    }

    private var symbolName: String {
        switch metric.trend {
        case .up:
            return "arrow.up.right"
        case .down:
            return "arrow.down.right"
        case .flat:
            return "minus"
        }
    }

    private var deltaText: String {
        let prefix = metric.delta > 0 ? "+" : ""
        return "\(prefix)\(metric.delta)% vs baseline"
    }
}

private struct FindingList: View {
    let findings: [DreamFinding]

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            SectionHeader(title: "Findings", systemImage: "lightbulb")

            ForEach(findings) { finding in
                FindingRow(finding: finding)
            }
        }
    }
}

private struct FindingRow: View {
    let finding: DreamFinding

    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            Image(systemName: iconName)
                .font(.headline)
                .foregroundStyle(iconColor)
                .frame(width: 28, height: 28)
                .background(iconColor.opacity(0.12), in: Circle())

            VStack(alignment: .leading, spacing: 6) {
                HStack(spacing: 8) {
                    Text(finding.project)
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(.secondary)
                    Text(finding.confidence.capitalized)
                        .font(.caption2.weight(.bold))
                        .foregroundStyle(.secondary)
                        .padding(.horizontal, 6)
                        .padding(.vertical, 3)
                        .background(Color(.secondarySystemGroupedBackground))
                        .clipShape(Capsule())
                }

                Text(finding.title)
                    .font(.headline)
                Text(finding.summary)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                Text(finding.action)
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(.primary)
            }
        }
        .padding(14)
        .background(.background)
        .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
    }

    private var iconName: String {
        switch finding.kind {
        case .win:
            return "checkmark.seal.fill"
        case .mistake:
            return "exclamationmark.triangle.fill"
        case .opportunity:
            return "sparkle.magnifyingglass"
        case .risk:
            return "shield.lefthalf.filled"
        }
    }

    private var iconColor: Color {
        switch finding.kind {
        case .win:
            return .green
        case .mistake:
            return .orange
        case .opportunity:
            return .blue
        case .risk:
            return .red
        }
    }
}

private struct GoalList: View {
    let goals: [DreamGoal]

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            SectionHeader(title: "Goals", systemImage: "target")

            ForEach(goals) { goal in
                VStack(alignment: .leading, spacing: 10) {
                    HStack {
                        Text(goal.title)
                            .font(.headline)
                        Spacer()
                        Text(goal.status.rawValue.capitalized)
                            .font(.caption.weight(.bold))
                            .foregroundStyle(.secondary)
                    }
                    ProgressView(value: goal.progress)
                        .tint(.teal)
                    Text(goal.metric)
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(.secondary)
                }
                .padding(14)
                .background(.background)
                .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
            }
        }
    }
}

private struct PrivacyBand: View {
    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            Image(systemName: "lock.shield")
                .font(.title3)
                .foregroundStyle(.teal)
            VStack(alignment: .leading, spacing: 4) {
                Text("Cycle signal only")
                    .font(.headline)
                Text("This companion app is scaffolded to receive scores, findings, and goals. Code, transcripts, and secrets stay on the Mac.")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
        .padding(14)
        .background(Color.teal.opacity(0.1))
        .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
    }
}

private struct SectionHeader: View {
    let title: String
    let systemImage: String

    var body: some View {
        Label(title, systemImage: systemImage)
            .font(.headline.weight(.bold))
    }
}

#Preview {
    CompanionRootView()
        .environmentObject(HarnessDreamsSignalStore())
}
