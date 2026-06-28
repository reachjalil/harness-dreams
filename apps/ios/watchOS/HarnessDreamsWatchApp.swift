import SwiftUI

@main
struct HarnessDreamsWatchApp: App {
    @StateObject private var store = HarnessDreamsSignalStore()

    var body: some Scene {
        WindowGroup {
            WatchRootView()
                .environmentObject(store)
        }
    }
}
