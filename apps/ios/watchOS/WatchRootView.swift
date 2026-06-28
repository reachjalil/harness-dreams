import SwiftUI

struct WatchRootView: View {
    @EnvironmentObject private var store: HarnessDreamsSignalStore

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 12) {
                    WatchScore(snapshot: store.snapshot)
                    WatchRingList(rings: store.snapshot.rings)

                    if let finding = store.snapshot.primaryFinding {
                        WatchFinding(finding: finding)
                    }

                    WatchPrivacyNote()
                }
                .padding(.horizontal, 4)
            }
            .navigationTitle("Dreams")
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        store.refreshFromDesktopSignal()
                    } label: {
                        Image(systemName: "arrow.clockwise")
                    }
                    .accessibilityLabel("Sync")
                }
            }
        }
    }
}

private struct WatchScore: View {
    let snapshot: DreamSignalSnapshot

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(alignment: .center) {
                Gauge(value: Double(snapshot.compositeScore), in: 0...100) {
                    Text("Score")
                } currentValueLabel: {
                    Text("\(snapshot.compositeScore)")
                        .font(.headline.weight(.bold))
                }
                .gaugeStyle(.accessoryCircularCapacity)
                .tint(.teal)

                VStack(alignment: .leading, spacing: 2) {
                    Text(snapshot.rangeLabel)
                        .font(.caption2.weight(.semibold))
                        .foregroundStyle(.secondary)
                    Text("\(snapshot.sessions) sessions")
                        .font(.caption)
                    Text("\(snapshot.projects) projects")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }

            Text(snapshot.digest)
                .font(.footnote)
                .lineLimit(4)
                .foregroundStyle(.secondary)
        }
        .padding(10)
        .containerBackground(.background, for: .navigation)
    }
}

private struct WatchRingList: View {
    let rings: [DreamRing]

    var body: some View {
        VStack(spacing: 8) {
            ForEach(rings) { ring in
                VStack(alignment: .leading, spacing: 4) {
                    HStack {
                        Text(ring.label)
                            .font(.caption.weight(.semibold))
                        Spacer()
                        Text("\(ring.score)")
                            .font(.caption.weight(.bold))
                    }
                    ProgressView(value: Double(ring.score), total: 100)
                        .tint(color(for: ring.key))
                    Text(deltaText(for: ring))
                        .font(.caption2.weight(.semibold))
                        .foregroundStyle(ring.delta >= 0 ? .green : .orange)
                }
                .padding(8)
                .background(.thinMaterial)
                .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
            }
        }
    }

    private func color(for key: DreamRingKey) -> Color {
        switch key {
        case .efficiency:
            return .teal
        case .effectiveness:
            return .blue
        case .alignment:
            return .green
        }
    }

    private func deltaText(for ring: DreamRing) -> String {
        let prefix = ring.delta > 0 ? "+" : ""
        return "\(prefix)\(ring.delta) vs baseline"
    }
}

private struct WatchFinding: View {
    let finding: DreamFinding

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Label(finding.project, systemImage: "lightbulb.fill")
                .font(.caption.weight(.semibold))
                .foregroundStyle(.yellow)
            Text(finding.title)
                .font(.headline)
            Text(finding.action)
                .font(.footnote)
                .foregroundStyle(.secondary)
                .lineLimit(3)
        }
        .padding(10)
        .background(.thinMaterial)
        .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
    }
}

private struct WatchPrivacyNote: View {
    var body: some View {
        Label("Scores, findings, and goals only", systemImage: "lock.shield")
            .font(.caption2.weight(.semibold))
            .foregroundStyle(.secondary)
            .padding(.vertical, 4)
    }
}

#Preview {
    WatchRootView()
        .environmentObject(HarnessDreamsSignalStore())
}
