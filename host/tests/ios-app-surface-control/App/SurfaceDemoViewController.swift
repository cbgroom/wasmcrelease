import UIKit

final class SurfaceDemoViewController: UIViewController {
    let provider = SurfaceControlProvider()
    private let titleLabel = UILabel()
    private let subtitleLabel = UILabel()
    private var timer: Timer?
    private var cards: [TaskSurfaceCard] = []
    private var compactFrames: [String: CGRect] = [:]
    private var expandedCard: TaskSurfaceCard?
    private var backgroundCountsAtHandoff: [String: Int] = [:]
    private var humanCountAtHandoff = 0
    private var humanText = ""
    private var tick = 0

    var onQualificationComplete: (([String: Any]) -> Void)?

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = UIColor(red: 0.045, green: 0.055, blue: 0.10, alpha: 1)

        titleLabel.text = "并行 Surface Lab"
        titleLabel.textColor = .white
        titleLabel.font = .systemFont(ofSize: 28, weight: .bold)
        titleLabel.accessibilityIdentifier = "surface-demo-title"
        subtitleLabel.text = "Agent 不占真实触摸 · 用户按需接管"
        subtitleLabel.textColor = UIColor.white.withAlphaComponent(0.62)
        subtitleLabel.font = .systemFont(ofSize: 13, weight: .medium)

        view.addSubview(titleLabel)
        view.addSubview(subtitleLabel)

        let definitions: [(String, String, String, UIColor, Bool)] = [
            ("task-1", "检索资料", "native", UIColor(red: 0.25, green: 0.35, blue: 0.88, alpha: 1), false),
            ("task-2", "整理数据", "native", UIColor(red: 0.08, green: 0.57, blue: 0.56, alpha: 1), false),
            ("task-3", "确认发布", "native", UIColor(red: 0.80, green: 0.32, blue: 0.36, alpha: 1), true),
            ("task-4", "生成摘要", "native", UIColor(red: 0.52, green: 0.30, blue: 0.80, alpha: 1), false),
            ("task-5", "检查结果", "native", UIColor(red: 0.88, green: 0.52, blue: 0.12, alpha: 1), false),
        ]

        cards = definitions.map { definition in
            let card = TaskSurfaceCard(
                id: definition.0,
                title: definition.1,
                kind: definition.2,
                color: definition.3,
                needsHuman: definition.4
            )
            card.onExpand = { [weak self, weak card] in
                guard let self, let card else { return }
                self.beginHumanHandoff(card)
            }
            card.onComplete = { [weak self, weak card] text in
                guard let self, let card else { return }
                self.completeHumanHandoff(card, text: text)
            }
            view.addSubview(card)
            provider.register(card)
            return card
        }

        timer = Timer.scheduledTimer(withTimeInterval: 0.12, repeats: true) { [weak self] _ in
            self?.runAgentTick()
        }
    }

    override func viewDidLayoutSubviews() {
        super.viewDidLayoutSubviews()
        titleLabel.frame = CGRect(x: 20, y: view.safeAreaInsets.top + 10, width: view.bounds.width - 40, height: 34)
        subtitleLabel.frame = CGRect(x: 20, y: titleLabel.frame.maxY + 2, width: view.bounds.width - 40, height: 22)

        let gap: CGFloat = 12
        let side: CGFloat = 16
        let top = subtitleLabel.frame.maxY + 14
        let width = (view.bounds.width - side * 2 - gap) / 2
        let height: CGFloat = 188
        for (index, card) in cards.enumerated() {
            let column = index % 2
            let row = index / 2
            let frame = CGRect(
                x: side + CGFloat(column) * (width + gap),
                y: top + CGFloat(row) * (height + gap),
                width: width,
                height: height
            )
            compactFrames[card.surfaceID] = frame
            if expandedCard !== card { card.frame = frame }
        }
        if let expandedCard {
            expandedCard.frame = expandedFrame()
        }
    }

    private func expandedFrame() -> CGRect {
        CGRect(
            x: 14,
            y: view.safeAreaInsets.top + 68,
            width: view.bounds.width - 28,
            height: min(390, view.bounds.height - view.safeAreaInsets.top - view.safeAreaInsets.bottom - 92)
        )
    }

    private func runAgentTick() {
        guard !cards.isEmpty else { return }
        tick += 1
        let card = cards[tick % cards.count]
        _ = provider.virtualActivate(surfaceID: card.surfaceID)
    }

    private func beginHumanHandoff(_ card: TaskSurfaceCard) {
        guard expandedCard == nil else { return }
        backgroundCountsAtHandoff = Dictionary(uniqueKeysWithValues: cards
            .filter { $0 !== card }
            .map { ($0.surfaceID, $0.agentActions) })
        humanCountAtHandoff = card.agentActions
        card.setOwner(.user)
        card.setExpanded(true)
        expandedCard = card
        view.bringSubviewToFront(card)
        UIView.animate(withDuration: 0.42, delay: 0, usingSpringWithDamping: 0.84,
                       initialSpringVelocity: 0.35) {
            card.frame = self.expandedFrame()
            card.layer.cornerRadius = 30
        } completion: { _ in
            card.humanInput.becomeFirstResponder()
        }
    }

    private func completeHumanHandoff(_ card: TaskSurfaceCard, text: String) {
        guard expandedCard === card else { return }
        humanText = text
        card.humanInput.resignFirstResponder()
        card.setOwner(.agent)
        let target = compactFrames[card.surfaceID] ?? card.frame
        UIView.animate(withDuration: 0.38, delay: 0, options: [.curveEaseInOut]) {
            card.frame = target
            card.layer.cornerRadius = 22
        } completion: { _ in
            card.setExpanded(false)
            self.expandedCard = nil
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.8) {
                self.finishQualification(humanCard: card)
            }
        }
    }

    private func finishQualification(humanCard: TaskSurfaceCard) {
        let backgroundProgress = cards.filter { $0 !== humanCard }.allSatisfy {
            $0.agentActions > (backgroundCountsAtHandoff[$0.surfaceID] ?? -1)
        }
        let report: [String: Any] = [
            "schema": "wasmc.ios-app-surface-control-qualification/v1",
            "accepted": backgroundProgress && humanCard.agentActions > humanCountAtHandoff && !humanText.isEmpty,
            "fixed_host_domain_apis": 0,
            "surface_count": cards.count,
            "agent_uses_physical_input": provider.agentUsesPhysicalInput,
            "human_surface": humanCard.surfaceID,
            "human_text": humanText,
            "human_surface_agent_mutations_during_handoff": provider.humanSurfaceMutationsWhileOwned,
            "blocked_agent_actions_during_handoff": provider.blockedAgentActionsDuringHumanHandoff,
            "background_surfaces_progressed_during_handoff": backgroundProgress,
            "agent_resumed_after_handoff": humanCard.agentActions > humanCountAtHandoff,
            "same_surface_instance_preserved": cards.contains { $0 === humanCard },
            "surface_snapshots": provider.snapshot(),
            "physical_device": false,
            "admitted": false,
            "released": false,
        ]
        onQualificationComplete?(report)
    }

    deinit { timer?.invalidate() }
}
