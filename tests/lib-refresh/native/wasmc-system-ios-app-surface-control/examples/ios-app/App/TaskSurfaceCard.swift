import UIKit

final class TaskSurfaceCard: UIView {
    let surfaceID: String
    let kind: String
    let agentActionButton = UIButton(type: .system)
    let expandButton = UIButton(type: .system)
    let confirmTakeoverButton = UIButton(type: .system)
    let cancelTakeoverButton = UIButton(type: .system)
    let humanInput = UITextField()
    let completeButton = UIButton(type: .system)

    private let titleLabel = UILabel()
    private let ownerLabel = UILabel()
    private let countLabel = UILabel()
    private let progress = UIProgressView(progressViewStyle: .default)
    private let cursor = UIView()
    private let confirmationLabel = UILabel()

    private(set) var owner: SurfaceOwner = .agent
    private(set) var generation: UInt64 = 1
    private(set) var agentActions = 0

    var onRequestTakeover: (() -> Void)?
    var onConfirmTakeover: (() -> Void)?
    var onCancelTakeover: (() -> Void)?
    var onComplete: ((String) -> Void)?

    init(id: String, title: String, kind: String, color: UIColor, needsHuman: Bool) {
        self.surfaceID = id
        self.kind = kind
        super.init(frame: .zero)

        backgroundColor = color
        layer.cornerRadius = 22
        layer.cornerCurve = .continuous
        layer.borderWidth = 1
        layer.borderColor = UIColor.white.withAlphaComponent(0.18).cgColor
        layer.shadowColor = UIColor.black.cgColor
        layer.shadowOpacity = 0.18
        layer.shadowRadius = 12
        layer.shadowOffset = CGSize(width: 0, height: 7)
        accessibilityIdentifier = "surface-\(id)"

        titleLabel.text = title
        titleLabel.textColor = .white
        titleLabel.font = .systemFont(ofSize: 17, weight: .bold)
        titleLabel.accessibilityIdentifier = "surface-\(id)-title"

        ownerLabel.textColor = UIColor.white.withAlphaComponent(0.76)
        ownerLabel.font = .systemFont(ofSize: 11, weight: .semibold)

        countLabel.textColor = .white
        countLabel.font = .monospacedDigitSystemFont(ofSize: 26, weight: .bold)
        countLabel.accessibilityIdentifier = "surface-\(id)-count"

        progress.trackTintColor = UIColor.white.withAlphaComponent(0.18)
        progress.progressTintColor = .white

        cursor.backgroundColor = .white
        cursor.layer.cornerRadius = 6
        cursor.layer.shadowColor = UIColor.white.cgColor
        cursor.layer.shadowOpacity = 0.9
        cursor.layer.shadowRadius = 7

        agentActionButton.isHidden = true
        agentActionButton.addAction(UIAction { [weak self] _ in
            self?.applyAgentAction()
        }, for: .primaryActionTriggered)

        expandButton.setTitle(needsHuman ? "查看接管" : "Agent 已锁定", for: .normal)
        expandButton.setTitleColor(.white, for: .normal)
        expandButton.titleLabel?.font = .systemFont(ofSize: 12, weight: .semibold)
        expandButton.backgroundColor = UIColor.white.withAlphaComponent(needsHuman ? 0.24 : 0.12)
        expandButton.layer.cornerRadius = 10
        expandButton.isUserInteractionEnabled = needsHuman
        expandButton.accessibilityIdentifier = "surface-\(id)-expand"
        expandButton.addAction(UIAction { [weak self] _ in self?.onRequestTakeover?() }, for: .touchUpInside)

        confirmationLabel.text = "此任务正在等待人工判断。确认后 Agent 才会暂停该窗口。"
        confirmationLabel.textColor = .white
        confirmationLabel.font = .systemFont(ofSize: 15, weight: .medium)
        confirmationLabel.numberOfLines = 0
        confirmationLabel.textAlignment = .center
        confirmationLabel.isHidden = true

        confirmTakeoverButton.setTitle("确认接管", for: .normal)
        confirmTakeoverButton.setTitleColor(.black, for: .normal)
        confirmTakeoverButton.backgroundColor = .white
        confirmTakeoverButton.layer.cornerRadius = 13
        confirmTakeoverButton.titleLabel?.font = .systemFont(ofSize: 15, weight: .bold)
        confirmTakeoverButton.accessibilityIdentifier = "surface-\(id)-confirm-takeover"
        confirmTakeoverButton.isHidden = true
        confirmTakeoverButton.addAction(UIAction { [weak self] _ in
            self?.onConfirmTakeover?()
        }, for: .touchUpInside)

        cancelTakeoverButton.setTitle("取消", for: .normal)
        cancelTakeoverButton.setTitleColor(.white, for: .normal)
        cancelTakeoverButton.backgroundColor = UIColor.white.withAlphaComponent(0.16)
        cancelTakeoverButton.layer.cornerRadius = 13
        cancelTakeoverButton.accessibilityIdentifier = "surface-\(id)-cancel-takeover"
        cancelTakeoverButton.isHidden = true
        cancelTakeoverButton.addAction(UIAction { [weak self] _ in
            self?.onCancelTakeover?()
        }, for: .touchUpInside)

        humanInput.placeholder = "输入确认内容"
        humanInput.backgroundColor = UIColor.white.withAlphaComponent(0.94)
        humanInput.textColor = .label
        humanInput.layer.cornerRadius = 12
        humanInput.leftView = UIView(frame: CGRect(x: 0, y: 0, width: 12, height: 1))
        humanInput.leftViewMode = .always
        humanInput.accessibilityIdentifier = "surface-\(id)-human-input"
        humanInput.isHidden = true

        completeButton.setTitle("完成并交还 Agent", for: .normal)
        completeButton.setTitleColor(.black, for: .normal)
        completeButton.backgroundColor = .white
        completeButton.layer.cornerRadius = 13
        completeButton.titleLabel?.font = .systemFont(ofSize: 15, weight: .bold)
        completeButton.accessibilityIdentifier = "surface-\(id)-complete"
        completeButton.isHidden = true
        completeButton.addAction(UIAction { [weak self] _ in
            guard let self else { return }
            self.onComplete?(self.humanInput.text ?? "")
        }, for: .touchUpInside)

        for child in [titleLabel, ownerLabel, countLabel, progress, cursor,
                      agentActionButton, expandButton, confirmationLabel,
                      confirmTakeoverButton, cancelTakeoverButton,
                      humanInput, completeButton] {
            child.translatesAutoresizingMaskIntoConstraints = false
            addSubview(child)
        }

        NSLayoutConstraint.activate([
            titleLabel.leadingAnchor.constraint(equalTo: leadingAnchor, constant: 16),
            titleLabel.topAnchor.constraint(equalTo: topAnchor, constant: 14),
            ownerLabel.leadingAnchor.constraint(equalTo: titleLabel.leadingAnchor),
            ownerLabel.topAnchor.constraint(equalTo: titleLabel.bottomAnchor, constant: 3),
            countLabel.leadingAnchor.constraint(equalTo: titleLabel.leadingAnchor),
            countLabel.topAnchor.constraint(equalTo: ownerLabel.bottomAnchor, constant: 8),
            cursor.trailingAnchor.constraint(equalTo: trailingAnchor, constant: -17),
            cursor.topAnchor.constraint(equalTo: topAnchor, constant: 17),
            cursor.widthAnchor.constraint(equalToConstant: 12),
            cursor.heightAnchor.constraint(equalToConstant: 12),
            progress.leadingAnchor.constraint(equalTo: leadingAnchor, constant: 16),
            progress.trailingAnchor.constraint(equalTo: trailingAnchor, constant: -16),
            progress.topAnchor.constraint(equalTo: countLabel.bottomAnchor, constant: 8),
            expandButton.leadingAnchor.constraint(equalTo: leadingAnchor, constant: 13),
            expandButton.trailingAnchor.constraint(equalTo: trailingAnchor, constant: -13),
            expandButton.bottomAnchor.constraint(equalTo: bottomAnchor, constant: -12),
            expandButton.heightAnchor.constraint(equalToConstant: 28),
            confirmationLabel.leadingAnchor.constraint(equalTo: leadingAnchor, constant: 28),
            confirmationLabel.trailingAnchor.constraint(equalTo: trailingAnchor, constant: -28),
            confirmationLabel.topAnchor.constraint(equalTo: topAnchor, constant: 145),
            confirmTakeoverButton.leadingAnchor.constraint(equalTo: leadingAnchor, constant: 24),
            confirmTakeoverButton.trailingAnchor.constraint(equalTo: trailingAnchor, constant: -24),
            confirmTakeoverButton.topAnchor.constraint(equalTo: confirmationLabel.bottomAnchor, constant: 20),
            confirmTakeoverButton.heightAnchor.constraint(equalToConstant: 48),
            cancelTakeoverButton.leadingAnchor.constraint(equalTo: leadingAnchor, constant: 24),
            cancelTakeoverButton.trailingAnchor.constraint(equalTo: trailingAnchor, constant: -24),
            cancelTakeoverButton.topAnchor.constraint(equalTo: confirmTakeoverButton.bottomAnchor, constant: 10),
            cancelTakeoverButton.heightAnchor.constraint(equalToConstant: 42),
            humanInput.leadingAnchor.constraint(equalTo: leadingAnchor, constant: 24),
            humanInput.trailingAnchor.constraint(equalTo: trailingAnchor, constant: -24),
            humanInput.topAnchor.constraint(equalTo: topAnchor, constant: 150),
            humanInput.heightAnchor.constraint(equalToConstant: 48),
            completeButton.leadingAnchor.constraint(equalTo: leadingAnchor, constant: 24),
            completeButton.trailingAnchor.constraint(equalTo: trailingAnchor, constant: -24),
            completeButton.topAnchor.constraint(equalTo: humanInput.bottomAnchor, constant: 18),
            completeButton.heightAnchor.constraint(equalToConstant: 48),
        ])

        setOwner(needsHuman ? .needsHuman : .agent)
        updateLabels()
    }

    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

    private func applyAgentAction() {
        guard owner == .agent else { return }
        agentActions += 1
        generation += 1
        updateLabels()
        cursor.transform = CGAffineTransform(scaleX: 1.8, y: 1.8)
        cursor.alpha = 0.35
        UIView.animate(withDuration: 0.18) {
            self.cursor.transform = .identity
            self.cursor.alpha = 1
        }
    }

    func setOwner(_ next: SurfaceOwner) {
        owner = next
        generation += 1
        updateLabels()
    }

    func setTakeoverPreview(_ presented: Bool) {
        confirmationLabel.isHidden = !presented
        confirmTakeoverButton.isHidden = !presented
        cancelTakeoverButton.isHidden = !presented
        humanInput.isHidden = true
        completeButton.isHidden = true
        setPresented(presented)
    }

    func setHumanMode(_ presented: Bool) {
        confirmationLabel.isHidden = true
        confirmTakeoverButton.isHidden = true
        cancelTakeoverButton.isHidden = true
        humanInput.isHidden = !presented
        completeButton.isHidden = !presented
        setPresented(presented)
    }

    private func setPresented(_ presented: Bool) {
        expandButton.isHidden = presented
        titleLabel.font = .systemFont(ofSize: presented ? 28 : 17, weight: .bold)
        countLabel.font = .monospacedDigitSystemFont(ofSize: presented ? 44 : 26, weight: .bold)
        accessibilityIdentifier = presented ? "surface-\(surfaceID)-expanded" : "surface-\(surfaceID)"
    }

    private func updateLabels() {
        ownerLabel.text = owner == .agent ? "AGENT · 独立虚拟操作" :
            owner == .user ? "USER · 人工接管中" : "需要人工介入"
        countLabel.text = String(format: "%02d", agentActions)
        progress.progress = Float(agentActions % 20) / 20.0
    }
}
