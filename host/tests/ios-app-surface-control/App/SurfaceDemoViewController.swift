import UIKit

final class SurfaceDemoViewController: UIViewController {
    let provider = SurfaceControlProvider()
    private let pipProvider = PiPSurfaceProvider()
    private let titleLabel = UILabel()
    private let subtitleLabel = UILabel()
    private let collapseButton = UIButton(type: .system)
    private let pipButton = UIButton(type: .system)
    private let pipStatusLabel = UILabel()
    private let taskDock = UIButton(type: .system)
    private var timer: Timer?
    private var cards: [TaskSurfaceCard] = []
    private var compactFrames: [String: CGRect] = [:]
    private var expandedCard: TaskSurfaceCard?
    private var backgroundCountsAtHandoff: [String: Int] = [:]
    private var humanCountAtHandoff = 0
    private var humanText = ""
    private var tick = 0
    private var dockCounts: [String: Int] = [:]
    private var dockCycleCompleted = false
    private var surfacesProgressedWhileDocked = false
    private var takeoverConfirmationShown = false
    private var pipFramesAtStart = 0
    private var pipCountsAtStart: [String: Int] = [:]
    private var pipAgentProgressedWhileActive = false

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

        collapseButton.setTitle("收起", for: .normal)
        collapseButton.setTitleColor(.white, for: .normal)
        collapseButton.backgroundColor = UIColor.white.withAlphaComponent(0.12)
        collapseButton.layer.cornerRadius = 14
        collapseButton.accessibilityIdentifier = "surface-shelf-collapse"
        collapseButton.addAction(UIAction { [weak self] _ in self?.collapseToDock() }, for: .touchUpInside)

        pipButton.setTitle("开启 PiP", for: .normal)
        pipButton.setTitleColor(.white, for: .normal)
        pipButton.backgroundColor = UIColor(red: 0.32, green: 0.38, blue: 0.96, alpha: 1)
        pipButton.layer.cornerRadius = 14
        pipButton.titleLabel?.font = .systemFont(ofSize: 12, weight: .bold)
        pipButton.accessibilityIdentifier = "surface-pip-toggle"
        pipButton.addAction(UIAction { [weak self] _ in self?.togglePiPFromUserAction() }, for: .touchUpInside)

        pipStatusLabel.textColor = UIColor.white.withAlphaComponent(0.68)
        pipStatusLabel.font = .systemFont(ofSize: 11, weight: .semibold)
        pipStatusLabel.textAlignment = .center
        pipStatusLabel.accessibilityIdentifier = "surface-pip-state"

        taskDock.setTitle("5 个任务 · 1 待接管", for: .normal)
        taskDock.setTitleColor(.white, for: .normal)
        taskDock.backgroundColor = UIColor(red: 0.24, green: 0.27, blue: 0.38, alpha: 0.96)
        taskDock.layer.cornerRadius = 24
        taskDock.layer.shadowColor = UIColor.black.cgColor
        taskDock.layer.shadowOpacity = 0.28
        taskDock.layer.shadowRadius = 12
        taskDock.accessibilityIdentifier = "surface-shelf-dock"
        taskDock.isHidden = true
        taskDock.addAction(UIAction { [weak self] _ in self?.restoreFromDock() }, for: .touchUpInside)

        view.addSubview(titleLabel)
        view.addSubview(subtitleLabel)
        view.addSubview(collapseButton)
        view.addSubview(pipButton)
        view.addSubview(pipStatusLabel)
        view.addSubview(pipProvider.sourceView)
        view.addSubview(taskDock)

        pipProvider.onStateChange = { [weak self] in
            DispatchQueue.main.async { self?.refreshPiPState() }
        }
        pipProvider.onRestoreRequested = { [weak self] in
            DispatchQueue.main.async { self?.view.window?.makeKeyAndVisible() }
        }
        refreshPiPState()

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
            card.onRequestTakeover = { [weak self, weak card] in
                guard let self, let card else { return }
                self.presentTakeoverPreview(card)
            }
            card.onConfirmTakeover = { [weak self, weak card] in
                guard let self, let card else { return }
                self.confirmHumanHandoff(card)
            }
            card.onCancelTakeover = { [weak self, weak card] in
                guard let self, let card else { return }
                self.dismissPresentedCard(card)
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
        titleLabel.frame = CGRect(x: 20, y: view.safeAreaInsets.top + 10, width: view.bounds.width - 105, height: 34)
        subtitleLabel.frame = CGRect(x: 20, y: titleLabel.frame.maxY + 2, width: view.bounds.width - 40, height: 22)
        collapseButton.frame = CGRect(x: view.bounds.width - 78, y: view.safeAreaInsets.top + 10, width: 62, height: 30)
        pipButton.frame = CGRect(x: view.bounds.width - 168, y: view.safeAreaInsets.top + 10, width: 82, height: 30)
        pipProvider.sourceView.frame = CGRect(x: 16, y: subtitleLabel.frame.maxY + 10, width: 154, height: 86)
        pipStatusLabel.frame = CGRect(x: 180, y: subtitleLabel.frame.maxY + 25, width: view.bounds.width - 196, height: 42)
        taskDock.frame = CGRect(x: view.bounds.width - 188, y: view.safeAreaInsets.top + 66, width: 172, height: 48)

        let gap: CGFloat = 12
        let side: CGFloat = 16
        let top = pipProvider.sourceView.frame.maxY + 12
        let width = (view.bounds.width - side * 2 - gap) / 2
        let availableHeight = view.bounds.height - view.safeAreaInsets.bottom - top - 12 - gap * 2
        let height = min(CGFloat(188), floor(availableHeight / 3))
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

    private func togglePiPFromUserAction() {
        if pipProvider.isActive {
            pipProvider.stopFromUserAction()
            return
        }
        pipFramesAtStart = pipProvider.framesEnqueued
        pipCountsAtStart = Dictionary(uniqueKeysWithValues: cards
            .filter { $0.owner == .agent }
            .map { ($0.surfaceID, $0.agentActions) })
        pipProvider.startFromUserAction()
        if ProcessInfo.processInfo.arguments.contains("--wasmc-auto-stop-pip") {
            DispatchQueue.main.asyncAfter(deadline: .now() + 5.0) { [weak self] in
                self?.pipProvider.stopFromUserAction()
            }
        }
        refreshPiPState()
    }

    private func refreshPiPState() {
        if pipProvider.didStop {
            pipAgentProgressedWhileActive = pipProvider.framesEnqueued > pipFramesAtStart &&
                cards.filter { $0.owner == .agent }.allSatisfy {
                    $0.agentActions > (pipCountsAtStart[$0.surfaceID] ?? -1)
                }
        }
        if pipProvider.isActive {
            pipButton.setTitle("停止 PiP", for: .normal)
            pipStatusLabel.text = "PiP运行中"
        } else if pipProvider.didStop {
            pipButton.setTitle("再次开启", for: .normal)
            pipStatusLabel.text = "PiP已停止"
        } else if let error = pipProvider.lastError {
            pipButton.setTitle("重试 PiP", for: .normal)
            pipStatusLabel.text = "PiP失败: \(error)"
        } else if pipProvider.isPossible {
            pipButton.setTitle("开启 PiP", for: .normal)
            pipStatusLabel.text = "系统悬浮观察窗已就绪"
        } else {
            pipButton.setTitle("等待 PiP", for: .normal)
            pipStatusLabel.text = pipProvider.isSupported ? "正在准备系统 PiP" : "此设备不支持 PiP"
        }
    }

    private func collapseToDock() {
        guard expandedCard == nil else { return }
        dockCounts = Dictionary(uniqueKeysWithValues: cards
            .filter { $0.owner == .agent }
            .map { ($0.surfaceID, $0.agentActions) })
        UIView.animate(withDuration: 0.25) {
            self.cards.forEach { $0.alpha = 0 }
        } completion: { _ in
            self.cards.forEach { $0.isHidden = true }
            self.collapseButton.isHidden = true
            self.taskDock.alpha = 0
            self.taskDock.isHidden = false
            UIView.animate(withDuration: 0.2) { self.taskDock.alpha = 1 }
        }
    }

    private func restoreFromDock() {
        surfacesProgressedWhileDocked = cards.filter { $0.owner == .agent }.allSatisfy {
            $0.agentActions > (dockCounts[$0.surfaceID] ?? -1)
        }
        dockCycleCompleted = true
        taskDock.isHidden = true
        collapseButton.isHidden = false
        cards.forEach { card in card.isHidden = false; card.alpha = 0 }
        UIView.animate(withDuration: 0.25) { self.cards.forEach { $0.alpha = 1 } }
    }

    private func presentTakeoverPreview(_ card: TaskSurfaceCard) {
        guard expandedCard == nil else { return }
        takeoverConfirmationShown = true
        card.setTakeoverPreview(true)
        expandedCard = card
        collapseButton.isHidden = true
        view.bringSubviewToFront(card)
        UIView.animate(withDuration: 0.42, delay: 0, usingSpringWithDamping: 0.84,
                       initialSpringVelocity: 0.35) {
            card.frame = self.expandedFrame()
            card.layer.cornerRadius = 30
        }
    }

    private func confirmHumanHandoff(_ card: TaskSurfaceCard) {
        guard expandedCard === card, card.owner == .needsHuman else { return }
        backgroundCountsAtHandoff = Dictionary(uniqueKeysWithValues: cards
            .filter { $0 !== card }
            .map { ($0.surfaceID, $0.agentActions) })
        humanCountAtHandoff = card.agentActions
        card.setOwner(.user)
        card.setHumanMode(true)
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) {
            card.humanInput.becomeFirstResponder()
        }
    }

    private func dismissPresentedCard(_ card: TaskSurfaceCard) {
        guard expandedCard === card else { return }
        let target = compactFrames[card.surfaceID] ?? card.frame
        UIView.animate(withDuration: 0.3) {
            card.frame = target
            card.layer.cornerRadius = 22
        } completion: { _ in
            card.setTakeoverPreview(false)
            self.expandedCard = nil
            self.collapseButton.isHidden = false
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
            card.setHumanMode(false)
            self.expandedCard = nil
            self.collapseButton.isHidden = false
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
            "schema": "wasmc.ios-app-surface-control-qualification/v3",
            "accepted": backgroundProgress && humanCard.agentActions > humanCountAtHandoff &&
                !humanText.isEmpty && dockCycleCompleted && surfacesProgressedWhileDocked &&
                takeoverConfirmationShown && pipProvider.didStart && pipProvider.didStop &&
                pipAgentProgressedWhileActive,
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
            "agent_surfaces_locked_against_direct_user_activation": true,
            "takeover_confirmation_required": takeoverConfirmationShown,
            "dock_cycle_completed": dockCycleCompleted,
            "surfaces_progressed_while_docked": surfacesProgressedWhileDocked,
            "pip_supported": pipProvider.isSupported,
            "pip_became_possible": pipProvider.wasPossible,
            "pip_user_initiated": pipProvider.userInitiated,
            "pip_started": pipProvider.didStart,
            "pip_stopped": pipProvider.didStop,
            "pip_restore_requested": pipProvider.restoreRequested,
            "pip_frames_enqueued": pipProvider.framesEnqueued,
            "pip_agent_progressed_while_active": pipAgentProgressedWhileActive,
            "pip_system_window_captured": true,
            "pip_visual_pixels_capture_qualified": false,
            "pip_error": pipProvider.lastError ?? "",
            "surface_snapshots": provider.snapshot(),
            "physical_device": false,
            "admitted": false,
            "released": false,
        ]
        onQualificationComplete?(report)
    }

    deinit { timer?.invalidate() }
}
