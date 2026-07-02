import Combine
import Foundation

public enum HealthRingKey: String, Codable, CaseIterable, Identifiable, Sendable {
    case efficiency
    case effectiveness
    case alignment

    public var id: String { rawValue }
}

public struct HealthRing: Codable, Hashable, Identifiable, Sendable {
    public var key: HealthRingKey
    public var label: String
    public var score: Int
    public var delta: Int
    public var hint: String

    public var id: HealthRingKey { key }

    public init(key: HealthRingKey, label: String, score: Int, delta: Int, hint: String) {
        self.key = key
        self.label = label
        self.score = score
        self.delta = delta
        self.hint = hint
    }
}

public enum HealthTrend: String, Codable, Sendable {
    case up
    case down
    case flat
}

public struct HealthMetric: Codable, Hashable, Identifiable, Sendable {
    public var key: String
    public var label: String
    public var value: String
    public var delta: Int
    public var trend: HealthTrend
    public var good: Bool

    public var id: String { key }

    public init(key: String, label: String, value: String, delta: Int, trend: HealthTrend, good: Bool) {
        self.key = key
        self.label = label
        self.value = value
        self.delta = delta
        self.trend = trend
        self.good = good
    }
}

public enum HealthFindingKind: String, Codable, Sendable {
    case win
    case mistake
    case opportunity
    case risk
}

public struct HealthFinding: Codable, Hashable, Identifiable, Sendable {
    public var id: String
    public var kind: HealthFindingKind
    public var title: String
    public var summary: String
    public var action: String
    public var project: String
    public var confidence: String

    public init(
        id: String,
        kind: HealthFindingKind,
        title: String,
        summary: String,
        action: String,
        project: String,
        confidence: String
    ) {
        self.id = id
        self.kind = kind
        self.title = title
        self.summary = summary
        self.action = action
        self.project = project
        self.confidence = confidence
    }
}

public enum HealthGoalStatus: String, Codable, Sendable {
    case proposed
    case running
    case concluded
}

public struct HealthGoal: Codable, Hashable, Identifiable, Sendable {
    public var id: String
    public var title: String
    public var status: HealthGoalStatus
    public var progress: Double
    public var metric: String

    public init(id: String, title: String, status: HealthGoalStatus, progress: Double, metric: String) {
        self.id = id
        self.title = title
        self.status = status
        self.progress = progress
        self.metric = metric
    }
}

public struct HealthProjectInsight: Codable, Hashable, Identifiable, Sendable {
    public var name: String
    public var sessions: Int
    public var turns: Int
    public var corrections: Int
    public var toolFailures: Int
    public var hedges: Int
    public var alignment: Int
    public var topics: [String]

    public var id: String { name }

    public init(
        name: String,
        sessions: Int,
        turns: Int,
        corrections: Int,
        toolFailures: Int,
        hedges: Int,
        alignment: Int,
        topics: [String]
    ) {
        self.name = name
        self.sessions = sessions
        self.turns = turns
        self.corrections = corrections
        self.toolFailures = toolFailures
        self.hedges = hedges
        self.alignment = alignment
        self.topics = topics
    }
}

public struct HealthContextHealth: Codable, Hashable, Sendable {
    public var score: Int
    public var status: String
    public var overloadedProjects: Int
    public var riskCount: Int
    public var chars: Int
    public var memoryFiles: Int
    public var skillCount: Int
    public var suggestions: [String]

    public init(
        score: Int,
        status: String,
        overloadedProjects: Int,
        riskCount: Int,
        chars: Int,
        memoryFiles: Int,
        skillCount: Int,
        suggestions: [String]
    ) {
        self.score = score
        self.status = status
        self.overloadedProjects = overloadedProjects
        self.riskCount = riskCount
        self.chars = chars
        self.memoryFiles = memoryFiles
        self.skillCount = skillCount
        self.suggestions = suggestions
    }
}

public struct WatchDailyRing: Codable, Hashable, Identifiable, Sendable {
    public var id: String
    public var label: String
    public var value: Double
    public var goal: Double
    public var unit: String
    public var progress: Double
    public var colorHex: String
    public var subtitle: String?

    public init(
        id: String,
        label: String,
        value: Double,
        goal: Double,
        unit: String,
        progress: Double,
        colorHex: String,
        subtitle: String? = nil
    ) {
        self.id = id
        self.label = label
        self.value = value
        self.goal = goal
        self.unit = unit
        self.progress = progress
        self.colorHex = colorHex
        self.subtitle = subtitle
    }

    public var computedProgress: Double {
        guard goal > 0 else { return max(progress, 0) }
        return max(value / goal, 0)
    }

    public var displayProgress: Double {
        min(computedProgress, 1)
    }

    public var overflowProgress: Double {
        guard computedProgress > 1 else { return 0 }

        let remainder = computedProgress.truncatingRemainder(dividingBy: 1)
        return remainder == 0 ? 1 : remainder
    }

    public var progressPercent: Int {
        Int((computedProgress * 100).rounded())
    }

    public var isComplete: Bool {
        computedProgress >= 1
    }
}

public enum WatchSnapshotActionKind: String, Codable, Sendable {
    case openPhone
    case queueRecommendation
    case acknowledgeFinding
    case refreshSnapshot
}

public struct WatchSnapshotAction: Codable, Hashable, Identifiable, Sendable {
    public var id: String
    public var title: String
    public var kind: WatchSnapshotActionKind

    public init(id: String, title: String, kind: WatchSnapshotActionKind) {
        self.id = id
        self.title = title
        self.kind = kind
    }
}

public struct WatchLatestAward: Codable, Hashable, Identifiable, Sendable {
    public var id: String
    public var title: String
    public var earnedAt: Date

    public init(id: String, title: String, earnedAt: Date) {
        self.id = id
        self.title = title
        self.earnedAt = earnedAt
    }
}

public struct WatchMetric: Codable, Hashable, Identifiable, Sendable {
    public var id: String
    public var label: String
    public var value: String
    public var detail: String
    public var colorHex: String
    public var symbolName: String

    public init(
        id: String,
        label: String,
        value: String,
        detail: String,
        colorHex: String,
        symbolName: String
    ) {
        self.id = id
        self.label = label
        self.value = value
        self.detail = detail
        self.colorHex = colorHex
        self.symbolName = symbolName
    }
}

public struct WatchDailySnapshot: Codable, Hashable, Sendable {
    public var schemaVersion: Int
    public var generatedAt: Date
    public var date: Date
    public var rings: [WatchDailyRing]
    public var nextAction: WatchSnapshotAction?
    public var latestAward: WatchLatestAward?
    public var activeHarness: String?
    public var sourceSummary: String?
    public var topMetrics: [WatchMetric]?

    public init(
        schemaVersion: Int,
        generatedAt: Date,
        date: Date,
        rings: [WatchDailyRing],
        nextAction: WatchSnapshotAction?,
        latestAward: WatchLatestAward?,
        activeHarness: String? = nil,
        sourceSummary: String? = nil,
        topMetrics: [WatchMetric]? = nil
    ) {
        self.schemaVersion = schemaVersion
        self.generatedAt = generatedAt
        self.date = date
        self.rings = rings
        self.nextAction = nextAction
        self.latestAward = latestAward
        self.activeHarness = activeHarness
        self.sourceSummary = sourceSummary
        self.topMetrics = topMetrics
    }

    public var healthScore: Int {
        guard !rings.isEmpty else { return 0 }
        return rings.map { min($0.progressPercent, 100) }.reduce(0, +) / rings.count
    }

    public var hasOneTapAction: Bool {
        nextAction != nil
    }
}

public enum WatchCompanionActionKind: String, Codable, Sendable {
    case openPhone
    case queueFinding
    case acknowledgeFinding
    case refreshSnapshot
}

public struct WatchCompanionAction: Codable, Hashable, Identifiable, Sendable {
    public var id: String
    public var kind: WatchCompanionActionKind
    public var title: String
    public var createdAt: Date
    public var payload: [String: String]

    public init(
        id: String,
        kind: WatchCompanionActionKind,
        title: String,
        createdAt: Date,
        payload: [String: String] = [:]
    ) {
        self.id = id
        self.kind = kind
        self.title = title
        self.createdAt = createdAt
        self.payload = payload
    }
}

public struct HealthSignalSnapshot: Codable, Hashable, Identifiable, Sendable {
    public var id: String
    public var completedAt: Date
    public var lastSyncedAt: Date
    public var rangeLabel: String
    public var harness: String
    public var digest: String
    public var sessions: Int
    public var projects: Int
    public var rings: [HealthRing]
    public var metrics: [HealthMetric]
    public var findings: [HealthFinding]
    public var goals: [HealthGoal]
    public var projectInsights: [HealthProjectInsight]
    public var contextHealth: HealthContextHealth?
    public var reviewStatus: String?

    public var compositeScore: Int {
        guard !rings.isEmpty else { return 0 }
        return rings.map(\.score).reduce(0, +) / rings.count
    }

    public var primaryFinding: HealthFinding? {
        findings.first
    }

    public init(
        id: String,
        completedAt: Date,
        lastSyncedAt: Date,
        rangeLabel: String,
        harness: String,
        digest: String,
        sessions: Int,
        projects: Int,
        rings: [HealthRing],
        metrics: [HealthMetric],
        findings: [HealthFinding],
        goals: [HealthGoal],
        projectInsights: [HealthProjectInsight] = [],
        contextHealth: HealthContextHealth? = nil,
        reviewStatus: String? = nil
    ) {
        self.id = id
        self.completedAt = completedAt
        self.lastSyncedAt = lastSyncedAt
        self.rangeLabel = rangeLabel
        self.harness = harness
        self.digest = digest
        self.sessions = sessions
        self.projects = projects
        self.rings = rings
        self.metrics = metrics
        self.findings = findings
        self.goals = goals
        self.projectInsights = projectInsights
        self.contextHealth = contextHealth
        self.reviewStatus = reviewStatus
    }

    public func refreshed(at date: Date = .now) -> HealthSignalSnapshot {
        var copy = self
        copy.lastSyncedAt = date
        return copy
    }

    public var watchDailySnapshot: WatchDailySnapshot {
        let rings = self.rings.map { ring in
            WatchDailyRing(
                id: ring.key.rawValue,
                label: ring.label,
                value: Double(ring.score),
                goal: 100,
                unit: "score",
                progress: Double(ring.score) / 100,
                colorHex: Self.watchColorHex(for: ring.key),
                subtitle: ring.hint
            )
        }
        let nextAction = primaryFinding.map { finding in
            WatchSnapshotAction(
                id: finding.id,
                title: finding.action,
                kind: .queueRecommendation
            )
        } ?? goals.first.map { goal in
            WatchSnapshotAction(
                id: goal.id,
                title: goal.title,
                kind: .openPhone
            )
        }
        let latestAward = goals.first.map { goal in
            WatchLatestAward(id: goal.id, title: goal.title, earnedAt: completedAt)
        } ?? primaryFinding.map { finding in
            WatchLatestAward(id: finding.id, title: finding.title, earnedAt: completedAt)
        }
        return WatchDailySnapshot(
            schemaVersion: 1,
            generatedAt: lastSyncedAt,
            date: completedAt,
            rings: rings,
            nextAction: nextAction,
            latestAward: latestAward,
            activeHarness: Self.watchHarnessProfile(from: harness),
            sourceSummary: "\(harness) · \(sessions) sessions · \(projects) projects",
            topMetrics: Self.watchMetrics(from: metrics)
        )
    }

    private static func watchMetrics(from metrics: [HealthMetric]) -> [WatchMetric] {
        let priority = [
            "tokens.total",
            "tokens_per_change",
            "tools.calls",
            "tool_success",
            "tools.error_rate",
            "reask",
            "effectiveness.score",
            "time.spent"
        ]
        return metrics
            .sorted { lhs, rhs in
                (priority.firstIndex(of: lhs.key) ?? priority.count) <
                    (priority.firstIndex(of: rhs.key) ?? priority.count)
            }
            .prefix(4)
            .map { metric in
                WatchMetric(
                    id: metric.key,
                    label: metric.label,
                    value: metric.value,
                    detail: Self.watchMetricDetail(metric),
                    colorHex: Self.watchMetricColorHex(metric),
                    symbolName: Self.watchMetricSymbol(metric)
                )
            }
    }

    private static func watchMetricDetail(_ metric: HealthMetric) -> String {
        let direction: String
        switch metric.trend {
        case .up:
            direction = metric.good ? "better" : "higher"
        case .down:
            direction = metric.good ? "lower" : "lower"
        case .flat:
            direction = "steady"
        }
        if metric.delta == 0 { return "Steady" }
        return "\(abs(metric.delta))% \(direction)"
    }

    private static func watchMetricColorHex(_ metric: HealthMetric) -> String {
        if metric.key.contains("token") || metric.key == "cost" {
            return "#FF375F"
        }
        if metric.key.contains("tool") {
            return "#30D158"
        }
        if metric.key.contains("reask") || metric.key.contains("error") {
            return "#FF9F43"
        }
        if metric.key.contains("time") {
            return "#5B8CFF"
        }
        return "#64D2FF"
    }

    private static func watchMetricSymbol(_ metric: HealthMetric) -> String {
        if metric.key.contains("token") || metric.key == "cost" {
            return "number"
        }
        if metric.key.contains("tool") {
            return "wrench.and.screwdriver.fill"
        }
        if metric.key.contains("reask") || metric.key.contains("error") {
            return "exclamationmark.triangle.fill"
        }
        if metric.key.contains("time") {
            return "clock.fill"
        }
        return "checkmark.seal.fill"
    }

    private static func watchHarnessProfile(from harness: String) -> String {
        let normalized = harness.lowercased()
        if normalized.contains("codex") && !normalized.contains("claude") {
            return "Codex"
        }
        if normalized.contains("claude") && !normalized.contains("codex") {
            return "Claude"
        }
        return "Global"
    }

    private static func watchColorHex(for key: HealthRingKey) -> String {
        switch key {
        case .efficiency:
            return "#FF375F"
        case .effectiveness:
            return "#30D158"
        case .alignment:
            return "#64D2FF"
        }
    }
}

public extension HealthSignalSnapshot {
    static let empty = HealthSignalSnapshot(
        id: "no-health-review",
        completedAt: .now,
        lastSyncedAt: .now,
        rangeLabel: "No review yet",
        harness: "Harness Health",
        digest: "No Harness Health review data has been received yet.",
        sessions: 0,
        projects: 0,
        rings: [
            HealthRing(
                key: .efficiency,
                label: "Efficiency",
                score: 0,
                delta: 0,
                hint: "Tokens and cost per accepted change"
            ),
            HealthRing(
                key: .effectiveness,
                label: "Effectiveness",
                score: 0,
                delta: 0,
                hint: "Useful output with less back-and-forth"
            ),
            HealthRing(
                key: .alignment,
                label: "Alignment",
                score: 0,
                delta: 0,
                hint: "Agent behavior matched intent"
            )
        ],
        metrics: [
            HealthMetric(key: "tokens.total", label: "Token Use", value: "0", delta: 0, trend: .flat, good: true),
            HealthMetric(key: "tools.calls", label: "Tool Use", value: "0", delta: 0, trend: .flat, good: true),
            HealthMetric(key: "tools.error_rate", label: "Error Rate", value: "0%", delta: 0, trend: .flat, good: true),
            HealthMetric(key: "effectiveness.score", label: "Effectiveness", value: "0", delta: 0, trend: .flat, good: true)
        ],
        findings: [],
        goals: [],
        contextHealth: HealthContextHealth(
            score: 0,
            status: "waiting",
            overloadedProjects: 0,
            riskCount: 0,
            chars: 0,
            memoryFiles: 0,
            skillCount: 0,
            suggestions: []
        )
    )

    static let preview = HealthSignalSnapshot(
        id: "health-review-2026-06-28",
        completedAt: Date(timeIntervalSince1970: 1_782_655_100),
        lastSyncedAt: Date(timeIntervalSince1970: 1_782_655_460),
        rangeLabel: "Last night - Jun 28",
        harness: "Codex + Claude Code",
        digest: "Solid health review. Efficiency rose while alignment held steady. One project still needs a clearer test command before agents claim work is complete.",
        sessions: 13,
        projects: 3,
        rings: [
            HealthRing(
                key: .efficiency,
                label: "Efficiency",
                score: 84,
                delta: 6,
                hint: "Tokens and cost per accepted change"
            ),
            HealthRing(
                key: .effectiveness,
                label: "Effectiveness",
                score: 72,
                delta: 2,
                hint: "Useful output with less back-and-forth"
            ),
            HealthRing(
                key: .alignment,
                label: "Alignment",
                score: 88,
                delta: 4,
                hint: "Agent behavior matched intent"
            )
        ],
        metrics: [
            HealthMetric(key: "tokens_per_change", label: "Tokens / change", value: "3.8k", delta: -12, trend: .down, good: true),
            HealthMetric(key: "cost", label: "Cost", value: "$2.40", delta: -8, trend: .down, good: true),
            HealthMetric(key: "reask", label: "Re-ask rate", value: "14%", delta: -5, trend: .down, good: true),
            HealthMetric(key: "tool_success", label: "Tool success", value: "96%", delta: 2, trend: .up, good: true)
        ],
        findings: [
            HealthFinding(
                id: "f_verify_win",
                kind: .win,
                title: "Verification reduced re-asks",
                summary: "Sessions that ended with verification needed fewer follow-up prompts.",
                action: "Keep verification as a default completion step.",
                project: "agent-fleet",
                confidence: "medium"
            ),
            HealthFinding(
                id: "f_test_hint",
                kind: .mistake,
                title: "Test command was still ambiguous",
                summary: "The agent guessed the validation path before the user redirected it.",
                action: "Add the canonical test command to AGENTS.md.",
                project: "agent-fleet",
                confidence: "high"
            ),
            HealthFinding(
                id: "f_shared_parser",
                kind: .opportunity,
                title: "Repeated CSV parser work",
                summary: "Two repos recreated similar parsing code this week.",
                action: "Extract or document the reusable parser pattern.",
                project: "zod-to-sql",
                confidence: "medium"
            )
        ],
        goals: [
            HealthGoal(
                id: "g_test_runner",
                title: "Reduce test-command corrections",
                status: .running,
                progress: 0.6,
                metric: "3 of 5 sessions improved"
            ),
            HealthGoal(
                id: "g_context_load",
                title: "Keep context below warning level",
                status: .proposed,
                progress: 0.25,
                metric: "1 overloaded project left"
            )
        ],
        projectInsights: [
            HealthProjectInsight(
                name: "agent-fleet",
                sessions: 7,
                turns: 148,
                corrections: 3,
                toolFailures: 2,
                hedges: 4,
                alignment: 86,
                topics: ["verification", "test command"]
            ),
            HealthProjectInsight(
                name: "zod-to-sql",
                sessions: 4,
                turns: 92,
                corrections: 1,
                toolFailures: 1,
                hedges: 2,
                alignment: 79,
                topics: ["parser", "reuse"]
            )
        ],
        contextHealth: HealthContextHealth(
            score: 82,
            status: "clear",
            overloadedProjects: 0,
            riskCount: 1,
            chars: 18_400,
            memoryFiles: 2,
            skillCount: 6,
            suggestions: ["Keep validation commands close to the project."]
        ),
        reviewStatus: "unreviewed"
    )
}

@MainActor
public final class HarnessHealthSignalStore: ObservableObject {
    @Published public private(set) var snapshot: HealthSignalSnapshot
    @Published public private(set) var syncStatus: String
    @Published public private(set) var queuedWatchActions: [WatchCompanionAction]

    private let devSyncClient: HarnessHealthDevSyncClient
    private var pairing: HarnessHealthDevPairing?

    public init(
        snapshot: HealthSignalSnapshot = .preview,
        queuedWatchActions: [WatchCompanionAction] = [],
        devSyncClient: HarnessHealthDevSyncClient = HarnessHealthDevSyncClient(),
        autoConnectDevMode: Bool = HarnessHealthDevSyncClient.devAutoConnectEnabled
    ) {
        self.snapshot = snapshot
        self.queuedWatchActions = queuedWatchActions
        self.syncStatus = autoConnectDevMode ? "Connecting to local Mac..." : "Offline preview"
        self.devSyncClient = devSyncClient

        if autoConnectDevMode {
            Task { [weak self] in
                await self?.autoConnectDevMode()
            }
        }
    }

    public func refreshFromDesktopSignal() {
        if HarnessHealthDevSyncClient.devAutoConnectEnabled {
            Task { [weak self] in
                await self?.autoConnectDevMode()
            }
            return
        }
        snapshot = snapshot.refreshed()
    }

    public func queueWatchAction(
        kind: WatchCompanionActionKind,
        title: String,
        payload: [String: String] = [:]
    ) {
        let action = WatchCompanionAction(
            id: UUID().uuidString,
            kind: kind,
            title: title,
            createdAt: .now,
            payload: payload
        )
        queuedWatchActions.insert(action, at: 0)
        syncStatus = "Action queued for iPhone"
    }

    public func queuePrimaryRecommendation() {
        if let finding = snapshot.primaryFinding {
            queueWatchAction(
                kind: .queueFinding,
                title: finding.action,
                payload: [
                    "findingId": finding.id,
                    "project": finding.project
                ]
            )
            return
        }
        if let goal = snapshot.goals.first {
            queueWatchAction(
                kind: .openPhone,
                title: goal.title,
                payload: ["goalId": goal.id]
            )
            return
        }
        queueWatchAction(kind: .refreshSnapshot, title: "Refresh Harness health")
    }

    public func clearQueuedWatchActions() {
        queuedWatchActions.removeAll()
        syncStatus = "No queued watch actions"
    }

    public func autoConnectDevMode() async {
        syncStatus = "Connecting to local Mac..."

        do {
            let nextPairing = try await devSyncClient.autoPairWatch()
            pairing = nextPairing

            if let nextSnapshot = try await devSyncClient.fetchSnapshot(pairing: nextPairing) {
                snapshot = nextSnapshot
                syncStatus = "Synced with local Mac"
            } else {
                snapshot = snapshot.refreshed()
                syncStatus = "Waiting for harness vitals"
            }
        } catch {
            snapshot = snapshot.refreshed()
            syncStatus = "Waiting for local Mac"
        }
    }
}

public struct HarnessHealthDevPairing: Sendable {
    public var token: String
    public var syncBaseURL: URL

    public init(token: String, syncBaseURL: URL) {
        self.token = token
        self.syncBaseURL = syncBaseURL
    }
}

public enum HarnessHealthDevSyncError: Error, LocalizedError, Sendable {
    case badStatus(Int)
    case invalidURL
    case invalidResponse

    public var errorDescription: String? {
        switch self {
        case let .badStatus(status):
            return "Dev sync returned HTTP \(status)."
        case .invalidURL:
            return "Dev sync URL was invalid."
        case .invalidResponse:
            return "Dev sync response was invalid."
        }
    }
}

public struct HarnessHealthDevSyncClient: Sendable {
    public static let defaultBaseURL = URL(string: "http://127.0.0.1:39391")!

    public static var devAutoConnectEnabled: Bool {
        #if DEBUG
            return true
        #else
            return false
        #endif
    }

    public var baseURL: URL

    public init(baseURL: URL = HarnessHealthDevSyncClient.defaultBaseURL) {
        self.baseURL = baseURL
    }

    public func autoPairWatch() async throws -> HarnessHealthDevPairing {
        guard var components = URLComponents(
            url: baseURL.appendingPathComponent("v1/dev/pair"),
            resolvingAgainstBaseURL: false
        ) else {
            throw HarnessHealthDevSyncError.invalidURL
        }
        components.queryItems = [
            URLQueryItem(name: "kind", value: "watch"),
            URLQueryItem(name: "deviceName", value: "Dev Apple Watch")
        ]
        guard let url = components.url else {
            throw HarnessHealthDevSyncError.invalidURL
        }

        let response = try JSONDecoder().decode(
            DevPairResponse.self,
            from: try await data(from: URLRequest(url: url))
        )
        guard let syncBaseURL = URL(string: response.cloudApiBaseUrl) else {
            throw HarnessHealthDevSyncError.invalidURL
        }
        return HarnessHealthDevPairing(
            token: response.pairingUrl,
            syncBaseURL: syncBaseURL
        )
    }

    public func fetchSnapshot(pairing: HarnessHealthDevPairing) async throws -> HealthSignalSnapshot? {
        let url = pairing.syncBaseURL.appendingPathComponent("v1/dev/snapshot")
        let response = try JSONDecoder().decode(
            DesktopSnapshotResponse.self,
            from: try await data(from: URLRequest(url: url))
        )
        return response.report?.snapshot()
    }

    private func data(from request: URLRequest) async throws -> Data {
        let (data, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse else {
            throw HarnessHealthDevSyncError.invalidResponse
        }
        guard (200..<300).contains(http.statusCode) else {
            throw HarnessHealthDevSyncError.badStatus(http.statusCode)
        }
        return data
    }
}

private struct DevPairResponse: Decodable {
    var pairingUrl: String
    var cloudApiBaseUrl: String
}

private struct DesktopSnapshotResponse: Decodable {
    var report: DesktopReport?
}

private struct DesktopReport: Decodable {
    var id: String
    var timestamp: Double
    var rangeLabel: String
    var sessions: Int
    var projects: Int
    var harness: String
    var digest: String
    var rings: [HealthRing]
    var metrics: [HealthMetric]
    var findings: [DesktopFinding]
    var experiments: [DesktopExperiment]?
    var reviewStatus: String?
    var contextHealth: HealthContextHealth?
    var projectInsights: [HealthProjectInsight]?

    func snapshot(now: Date = .now) -> HealthSignalSnapshot {
        HealthSignalSnapshot(
            id: id,
            completedAt: Date(timeIntervalSince1970: timestamp / 1_000),
            lastSyncedAt: now,
            rangeLabel: rangeLabel,
            harness: harness,
            digest: digest,
            sessions: sessions,
            projects: projects,
            rings: rings,
            metrics: metrics,
            findings: findings.map { $0.finding() },
            goals: (experiments ?? []).map { $0.goal() },
            projectInsights: projectInsights ?? [],
            contextHealth: contextHealth,
            reviewStatus: reviewStatus
        )
    }
}

private struct DesktopFinding: Decodable {
    var id: String
    var type: HealthFindingKind
    var title: String
    var summary: String
    var action: String
    var confidence: String
    var project: String

    func finding() -> HealthFinding {
        HealthFinding(
            id: id,
            kind: type,
            title: title,
            summary: summary,
            action: action,
            project: project,
            confidence: confidence
        )
    }
}

private struct DesktopExperiment: Decodable {
    var id: String
    var title: String
    var metric: String
    var status: HealthGoalStatus
    var progress: Double?
    var progressLabel: String?

    func goal() -> HealthGoal {
        HealthGoal(
            id: id,
            title: title,
            status: status,
            progress: progress ?? 0,
            metric: progressLabel ?? metric
        )
    }
}
