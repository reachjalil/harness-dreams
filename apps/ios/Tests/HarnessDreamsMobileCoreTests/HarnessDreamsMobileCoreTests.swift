import XCTest
@testable import HarnessDreamsMobileCore

final class HarnessDreamsMobileCoreTests: XCTestCase {
    func testPreviewSnapshotKeepsOnlyCycleSignal() throws {
        let snapshot = DreamSignalSnapshot.preview

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
}
