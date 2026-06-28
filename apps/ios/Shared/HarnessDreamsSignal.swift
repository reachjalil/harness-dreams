import Combine
import Foundation

public enum DreamRingKey: String, Codable, CaseIterable, Identifiable, Sendable {
    case efficiency
    case effectiveness
    case alignment

    public var id: String { rawValue }
}

public struct DreamRing: Codable, Hashable, Identifiable, Sendable {
    public var key: DreamRingKey
    public var label: String
    public var score: Int
    public var delta: Int
    public var hint: String

    public var id: DreamRingKey { key }

    public init(key: DreamRingKey, label: String, score: Int, delta: Int, hint: String) {
        self.key = key
        self.label = label
        self.score = score
        self.delta = delta
        self.hint = hint
    }
}

public enum DreamTrend: String, Codable, Sendable {
    case up
    case down
    case flat
}

public struct DreamMetric: Codable, Hashable, Identifiable, Sendable {
    public var key: String
    public var label: String
    public var value: String
    public var delta: Int
    public var trend: DreamTrend
    public var good: Bool

    public var id: String { key }

    public init(key: String, label: String, value: String, delta: Int, trend: DreamTrend, good: Bool) {
        self.key = key
        self.label = label
        self.value = value
        self.delta = delta
        self.trend = trend
        self.good = good
    }
}

public enum DreamFindingKind: String, Codable, Sendable {
    case win
    case mistake
    case opportunity
    case risk
}

public struct DreamFinding: Codable, Hashable, Identifiable, Sendable {
    public var id: String
    public var kind: DreamFindingKind
    public var title: String
    public var summary: String
    public var action: String
    public var project: String
    public var confidence: String

    public init(
        id: String,
        kind: DreamFindingKind,
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

public enum DreamGoalStatus: String, Codable, Sendable {
    case proposed
    case running
    case concluded
}

public struct DreamGoal: Codable, Hashable, Identifiable, Sendable {
    public var id: String
    public var title: String
    public var status: DreamGoalStatus
    public var progress: Double
    public var metric: String

    public init(id: String, title: String, status: DreamGoalStatus, progress: Double, metric: String) {
        self.id = id
        self.title = title
        self.status = status
        self.progress = progress
        self.metric = metric
    }
}

public struct DreamSignalSnapshot: Codable, Hashable, Identifiable, Sendable {
    public var id: String
    public var completedAt: Date
    public var lastSyncedAt: Date
    public var rangeLabel: String
    public var harness: String
    public var digest: String
    public var sessions: Int
    public var projects: Int
    public var rings: [DreamRing]
    public var metrics: [DreamMetric]
    public var findings: [DreamFinding]
    public var goals: [DreamGoal]

    public var compositeScore: Int {
        guard !rings.isEmpty else { return 0 }
        return rings.map(\.score).reduce(0, +) / rings.count
    }

    public var primaryFinding: DreamFinding? {
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
        rings: [DreamRing],
        metrics: [DreamMetric],
        findings: [DreamFinding],
        goals: [DreamGoal]
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
    }

    public func refreshed(at date: Date = .now) -> DreamSignalSnapshot {
        var copy = self
        copy.lastSyncedAt = date
        return copy
    }
}

public extension DreamSignalSnapshot {
    static let preview = DreamSignalSnapshot(
        id: "cycle-2026-06-28",
        completedAt: Date(timeIntervalSince1970: 1_782_655_100),
        lastSyncedAt: Date(timeIntervalSince1970: 1_782_655_460),
        rangeLabel: "Last night - Jun 28",
        harness: "Codex + Claude Code",
        digest: "Solid cycle. Efficiency rose while alignment held steady. One project still needs a clearer test command before agents claim work is complete.",
        sessions: 13,
        projects: 3,
        rings: [
            DreamRing(
                key: .efficiency,
                label: "Efficiency",
                score: 84,
                delta: 6,
                hint: "Tokens and cost per accepted change"
            ),
            DreamRing(
                key: .effectiveness,
                label: "Effectiveness",
                score: 72,
                delta: 2,
                hint: "Useful output with less back-and-forth"
            ),
            DreamRing(
                key: .alignment,
                label: "Alignment",
                score: 88,
                delta: 4,
                hint: "Agent behavior matched intent"
            )
        ],
        metrics: [
            DreamMetric(key: "tokens_per_change", label: "Tokens / change", value: "3.8k", delta: -12, trend: .down, good: true),
            DreamMetric(key: "cost", label: "Cost", value: "$2.40", delta: -8, trend: .down, good: true),
            DreamMetric(key: "reask", label: "Re-ask rate", value: "14%", delta: -5, trend: .down, good: true),
            DreamMetric(key: "tool_success", label: "Tool success", value: "96%", delta: 2, trend: .up, good: true)
        ],
        findings: [
            DreamFinding(
                id: "f_verify_win",
                kind: .win,
                title: "Verification reduced re-asks",
                summary: "Sessions that ended with verification needed fewer follow-up prompts.",
                action: "Keep verification as a default completion step.",
                project: "agent-fleet",
                confidence: "medium"
            ),
            DreamFinding(
                id: "f_test_hint",
                kind: .mistake,
                title: "Test command was still ambiguous",
                summary: "The agent guessed the validation path before the user redirected it.",
                action: "Add the canonical test command to AGENTS.md.",
                project: "agent-fleet",
                confidence: "high"
            ),
            DreamFinding(
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
            DreamGoal(
                id: "g_test_runner",
                title: "Reduce test-command corrections",
                status: .running,
                progress: 0.6,
                metric: "3 of 5 sessions improved"
            ),
            DreamGoal(
                id: "g_context_load",
                title: "Keep context below warning level",
                status: .proposed,
                progress: 0.25,
                metric: "1 overloaded project left"
            )
        ]
    )
}

@MainActor
public final class HarnessDreamsSignalStore: ObservableObject {
    @Published public private(set) var snapshot: DreamSignalSnapshot

    public init(snapshot: DreamSignalSnapshot = .preview) {
        self.snapshot = snapshot
    }

    public func refreshFromDesktopSignal() {
        snapshot = snapshot.refreshed()
    }
}
