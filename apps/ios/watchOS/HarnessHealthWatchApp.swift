import SwiftUI

@main
struct HarnessHealthWatchApp: App {
    @StateObject private var store = HarnessHealthSignalStore()

    var body: some Scene {
        WindowGroup {
            WatchRootView()
                .environmentObject(store)
        }
    }
}
