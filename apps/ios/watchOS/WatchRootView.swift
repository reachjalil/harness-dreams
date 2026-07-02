import SwiftUI

struct WatchRootView: View {
    @EnvironmentObject private var store: HarnessHealthSignalStore

    var body: some View {
        let compactSnapshot = store.snapshot.watchDailySnapshot

        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 8) {
                    NavigationLink {
                        WatchRingDetailList(
                            compactSnapshot: compactSnapshot,
                            rangeLabel: store.snapshot.rangeLabel,
                            status: store.syncStatus
                        )
                    } label: {
                        WatchRingCluster(snapshot: compactSnapshot)
                    }
                    .buttonStyle(.plain)

                    WatchStatusHeader(
                        compactSnapshot: compactSnapshot,
                        status: store.syncStatus,
                        rangeLabel: store.snapshot.rangeLabel
                    )

                    WatchMetricVitals(compactSnapshot: compactSnapshot)

                    WatchActionCard(
                        compactSnapshot: compactSnapshot,
                        queuedCount: store.queuedWatchActions.count,
                        onQueue: store.queuePrimaryRecommendation
                    )

                    if let latestDetail = compactSnapshot.latestAward {
                        WatchRecentDetailCard(detail: latestDetail)
                    }

                    WatchQueuedActions(
                        actions: store.queuedWatchActions,
                        onClear: store.clearQueuedWatchActions
                    )

                    WatchSourceFooter(
                        status: store.syncStatus,
                        compactSnapshot: compactSnapshot
                    )
                }
                .padding(.horizontal, 5)
                .padding(.bottom, 8)
            }
            .navigationTitle("Today")
            .navigationBarTitleDisplayMode(.inline)
        }
    }
}

#Preview {
    WatchRootView()
        .environmentObject(HarnessHealthSignalStore())
}
