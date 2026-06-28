import SwiftUI

@main
struct HarnessDreamsCompanionApp: App {
    @StateObject private var store = HarnessDreamsSignalStore()

    var body: some Scene {
        WindowGroup {
            CompanionRootView()
                .environmentObject(store)
        }
    }
}
