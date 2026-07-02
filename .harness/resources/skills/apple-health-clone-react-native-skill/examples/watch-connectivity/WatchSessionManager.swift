import Foundation
import WatchConnectivity
import SwiftUI

struct WatchRing: Codable, Identifiable {
    let id: String
    let label: String
    let value: Double
    let goal: Double
    let unit: String
    let progress: Double
    let colorHex: String
}

struct WatchDailySnapshot: Codable {
    let schemaVersion: Int
    let generatedAt: String
    let date: String
    let rings: [WatchRing]
}

final class WatchSessionManager: NSObject, ObservableObject, WCSessionDelegate {
    @Published var snapshot: WatchDailySnapshot?
    @Published var isReachable: Bool = false

    override init() {
        super.init()
        activate()
    }

    func activate() {
        guard WCSession.isSupported() else { return }
        WCSession.default.delegate = self
        WCSession.default.activate()
    }

    func sendAction(_ action: [String: Any]) {
        guard WCSession.default.activationState == .activated else { return }

        let message: [String: Any] = [
            "type": "watchAction",
            "schemaVersion": 1,
            "payload": action
        ]

        if WCSession.default.isReachable {
            WCSession.default.sendMessage(message, replyHandler: nil) { error in
                print("sendMessage failed: \(error.localizedDescription)")
                WCSession.default.transferUserInfo(message)
            }
        } else {
            WCSession.default.transferUserInfo(message)
        }
    }

    func session(_ session: WCSession, activationDidCompleteWith activationState: WCSessionActivationState, error: Error?) {
        DispatchQueue.main.async {
            self.isReachable = session.isReachable
        }
    }

    func sessionReachabilityDidChange(_ session: WCSession) {
        DispatchQueue.main.async {
            self.isReachable = session.isReachable
        }
    }

    func session(_ session: WCSession, didReceiveApplicationContext applicationContext: [String : Any]) {
        handlePayload(applicationContext)
    }

    func session(_ session: WCSession, didReceiveMessage message: [String : Any]) {
        handlePayload(message)
    }

    private func handlePayload(_ payload: [String: Any]) {
        guard let type = payload["type"] as? String, type == "dailySnapshot" else { return }
        guard let snapshotDict = payload["payload"] as? [String: Any] else { return }

        do {
            let data = try JSONSerialization.data(withJSONObject: snapshotDict, options: [])
            let decoded = try JSONDecoder().decode(WatchDailySnapshot.self, from: data)
            guard decoded.schemaVersion == 1 else { return }
            DispatchQueue.main.async {
                self.snapshot = decoded
            }
        } catch {
            print("Failed to decode WatchDailySnapshot: \(error.localizedDescription)")
        }
    }
}
