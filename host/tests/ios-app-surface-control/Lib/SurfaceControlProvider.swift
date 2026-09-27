import Foundation
import UIKit

enum SurfaceOwner: String {
    case agent
    case needsHuman = "needs-human"
    case user
}

struct SurfaceSnapshot {
    let id: String
    let kind: String
    let owner: SurfaceOwner
    let generation: UInt64
    let agentActions: Int
    let frame: CGRect

    var json: [String: Any] {
        [
            "id": id,
            "kind": kind,
            "owner": owner.rawValue,
            "generation": generation,
            "agent_actions": agentActions,
            "frame": [
                "x": Int(frame.origin.x.rounded()),
                "y": Int(frame.origin.y.rounded()),
                "width": Int(frame.width.rounded()),
                "height": Int(frame.height.rounded()),
            ],
        ]
    }
}

final class SurfaceControlProvider {
    private(set) var cards: [String: TaskSurfaceCard] = [:]
    private(set) var agentUsesPhysicalInput = false
    private(set) var humanSurfaceMutationsWhileOwned = 0
    private(set) var blockedAgentActionsDuringHumanHandoff = 0

    func register(_ card: TaskSurfaceCard) {
        precondition(cards[card.surfaceID] == nil)
        cards[card.surfaceID] = card
    }

    @discardableResult
    func virtualActivate(surfaceID: String) -> Bool {
        guard let card = cards[surfaceID] else { return false }
        guard card.owner == .agent else {
            if card.owner == .user { blockedAgentActionsDuringHumanHandoff += 1 }
            return false
        }
        // This is deliberately an in-App semantic action. It never enters the
        // UIApplication event stream and never occupies a real touch or pointer.
        card.agentActionButton.sendActions(for: .primaryActionTriggered)
        return true
    }

    func snapshot() -> [[String: Any]] {
        cards.values.sorted { $0.surfaceID < $1.surfaceID }.map {
            SurfaceSnapshot(
                id: $0.surfaceID,
                kind: $0.kind,
                owner: $0.owner,
                generation: $0.generation,
                agentActions: $0.agentActions,
                frame: $0.frame
            ).json
        }
    }

    static func descriptorProbe(_ input: Data) throws -> Data {
        try JSONSerialization.data(withJSONObject: [
            "surface_count": 5,
            "physical_input_injection": false,
            "capabilities": [
                "snapshot", "virtual-activate", "confirmed-handoff",
                "compact-expand", "edge-dock",
            ],
        ], options: [.sortedKeys])
    }
}
