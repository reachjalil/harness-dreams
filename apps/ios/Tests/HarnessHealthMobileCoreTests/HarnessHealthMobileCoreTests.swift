import XCTest
@testable import HarnessHealthMobileCore

final class HarnessHealthMobileCoreTests: XCTestCase {
    func testPreviewSnapshotKeepsOnlyHealthSignal() throws {
        let snapshot = HealthSignalSnapshot.preview

        XCTAssertEqual(snapshot.compositeScore, 81)
        XCTAssertEqual(snapshot.rings.count, 3)
        XCTAssertEqual(snapshot.metrics.count, 4)
        XCTAssertEqual(snapshot.primaryFinding?.title, "Verification reduced re-asks")

        let encoded = try JSONEncoder().encode(snapshot)
        let json = try XCTUnwrap(String(data: encoded, encoding: .utf8))

        XCTAssertFalse(json.contains("/Users/"))
        XCTAssertFalse(json.localizedCaseInsensitiveContains("transcript"))
        XCTAssertFalse(json.localizedCaseInsensitiveContains("secret"))
    }

    func testWatchDailySnapshotUsesCompactContract() throws {
        let compact = HealthSignalSnapshot.preview.watchDailySnapshot

        XCTAssertEqual(compact.schemaVersion, 1)
        XCTAssertEqual(compact.rings.count, 3)
        XCTAssertEqual(compact.healthScore, HealthSignalSnapshot.preview.compositeScore)
        XCTAssertEqual(compact.rings.first?.goal, 100)
        XCTAssertEqual(compact.nextAction?.kind, .queueRecommendation)
        XCTAssertTrue(compact.hasOneTapAction)
        XCTAssertNotNil(compact.latestAward)
        XCTAssertEqual(compact.activeHarness, "Global")
        XCTAssertEqual(compact.topMetrics?.count, 4)
        XCTAssertEqual(compact.topMetrics?.first?.label, "Tokens / change")
        XCTAssertEqual(compact.rings.first?.subtitle, "Tokens and cost per accepted change")
        XCTAssertTrue(compact.sourceSummary?.contains("Codex + Claude Code") == true)

        let encoded = try JSONEncoder().encode(compact)
        let json = try XCTUnwrap(String(data: encoded, encoding: .utf8))

        XCTAssertFalse(json.localizedCaseInsensitiveContains("digest"))
        XCTAssertFalse(json.localizedCaseInsensitiveContains("secret"))
        XCTAssertFalse(json.localizedCaseInsensitiveContains("transcript"))
    }

    func testWatchDailyRingProgressSupportsOverflow() throws {
        let ring = WatchDailyRing(
            id: "focus",
            label: "Focus",
            value: 150,
            goal: 100,
            unit: "score",
            progress: 1.5,
            colorHex: "#33D6C4"
        )

        XCTAssertEqual(ring.progressPercent, 150)
        XCTAssertEqual(ring.displayProgress, 1)
        XCTAssertEqual(ring.overflowProgress, 0.5)
        XCTAssertTrue(ring.isComplete)
    }

    func testWatchDailySnapshotCapsHealthScoreWhileKeepingRingOverflow() throws {
        let compact = WatchDailySnapshot(
            schemaVersion: 1,
            generatedAt: .now,
            date: .now,
            rings: [
                WatchDailyRing(
                    id: "focus",
                    label: "Focus",
                    value: 150,
                    goal: 100,
                    unit: "score",
                    progress: 1.5,
                    colorHex: "#FF375F"
                ),
                WatchDailyRing(
                    id: "review",
                    label: "Review",
                    value: 100,
                    goal: 100,
                    unit: "score",
                    progress: 1,
                    colorHex: "#30D158"
                )
            ],
            nextAction: nil,
            latestAward: nil
        )

        XCTAssertEqual(compact.healthScore, 100)
        XCTAssertEqual(compact.rings.first?.progressPercent, 150)
    }
}
