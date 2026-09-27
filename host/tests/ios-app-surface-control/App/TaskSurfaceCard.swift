import UIKit

final class TaskSurfaceCard: UIView {
    let surfaceID: String
    let kind: String
    let agentActionButton = UIButton(type: .system)
    let expandButton = UIButton(type: .system)
    let humanInput = UITextField()
    let completeButton = UIButton(type: .system)

    private let titleLabel = UILabel()
    private let ownerLabel = UILabel()
    private let countLabel = UILabel()
    private let progress = UIProgressView(progressViewStyle: .default)
    private let cursor = UIView()

    private(set) var owner: SurfaceOwner = .agent
    private(set) var generation: UInt64 = 1
    private(set) var agentActions = 0

    var onExpand: (() -> Void)?
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

        expandButton.setTitle(needsHuman ? "需要人工介入" : "Agent 自动执行", for: .normal)
        expandButton.setTitleColor(.white, for: .normal)
        expandButton.titleLabel?.font = .systemFont(ofSize: 12, weight: .semibold)
        expandButton.backgroundColor = UIColor.white.withAlphaComponent(needsHuman ? 0.24 : 0.12)
        expandButton.layer.cornerRadius = 10
        expandButton.isUserInteractionEnabled = needsHuman
        expandButton.accessibilityIdentifier = "surface-\(id)-expand"
        expandButton.addAction(UIAction { [weak self] _ in self?.onExpand?() }, for: .touchUpInside)

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
                      agentActionButton, expandButton, humanInput, completeButton] {
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

    func setExpanded(_ expanded: Bool) {
        humanInput.isHidden = !expanded
        completeButton.isHidden = !expanded
        expandButton.isHidden = expanded
        titleLabel.font = .systemFont(ofSize: expanded ? 28 : 17, weight: .bold)
        countLabel.font = .monospacedDigitSystemFont(ofSize: expanded ? 44 : 26, weight: .bold)
        accessibilityIdentifier = expanded ? "surface-\(surfaceID)-expanded" : "surface-\(surfaceID)"
    }

    private func updateLabels() {
        ownerLabel.text = owner == .agent ? "AGENT · 独立虚拟操作" :
            owner == .user ? "USER · 人工接管中" : "需要人工介入"
        countLabel.text = String(format: "%02d", agentActions)
        progress.progress = Float(agentActions % 20) / 20.0
    }
}
