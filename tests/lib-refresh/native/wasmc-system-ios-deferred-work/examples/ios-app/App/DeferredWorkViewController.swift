import UIKit

final class DeferredWorkViewController: UIViewController {
    private let provider: DeferredWorkProvider
    private let providerEvidence: [[String: Any]]
    private let titleLabel = UILabel()
    private let statusLabel = UILabel()
    private let scheduleButton = UIButton(type: .system)
    private let cancelButton = UIButton(type: .system)

    init(provider: DeferredWorkProvider, providerEvidence: [[String: Any]]) {
        self.provider = provider
        self.providerEvidence = providerEvidence
        super.init(nibName: nil, bundle: nil)
    }
    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = UIColor(red: 0.04, green: 0.06, blue: 0.11, alpha: 1)
        titleLabel.text = "iOS 延迟任务实验"
        titleLabel.textColor = .white
        titleLabel.font = .systemFont(ofSize: 26, weight: .bold)
        titleLabel.accessibilityIdentifier = "deferred-work-title"
        statusLabel.textColor = UIColor(red: 0.40, green: 0.90, blue: 0.66, alpha: 1)
        statusLabel.numberOfLines = 0
        scheduleButton.setTitle("提交 Refresh", for: .normal)
        scheduleButton.accessibilityIdentifier = "deferred-work-schedule"
        scheduleButton.addAction(UIAction { [weak self] _ in self?.provider.schedule() }, for: .touchUpInside)
        cancelButton.setTitle("取消 Refresh", for: .normal)
        cancelButton.accessibilityIdentifier = "deferred-work-cancel"
        cancelButton.addAction(UIAction { [weak self] _ in self?.provider.cancel() }, for: .touchUpInside)
        [titleLabel, statusLabel, scheduleButton, cancelButton].forEach(view.addSubview)
        NotificationCenter.default.addObserver(
            self, selector: #selector(refresh), name: DeferredWorkProvider.didChange, object: provider
        )
        refresh()
    }

    override func viewDidLayoutSubviews() {
        super.viewDidLayoutSubviews()
        let width = view.bounds.width - 40
        titleLabel.frame = CGRect(x: 20, y: view.safeAreaInsets.top + 36, width: width, height: 36)
        scheduleButton.frame = CGRect(x: 20, y: titleLabel.frame.maxY + 24, width: width, height: 48)
        cancelButton.frame = CGRect(x: 20, y: scheduleButton.frame.maxY + 12, width: width, height: 48)
        statusLabel.frame = CGRect(x: 20, y: cancelButton.frame.maxY + 20, width: width, height: 150)
    }

    @objc private func refresh() {
        var report = provider.report()
        report["provider_evidence"] = providerEvidence
        Self.writeReport(report)
        if report["accepted"] as? Bool == true {
            statusLabel.text = "deferred-work:accepted"
            statusLabel.accessibilityIdentifier = "deferred-work-complete"
        } else if report["diagnostic_complete"] as? Bool == true {
            statusLabel.text = "deferred-work:simulator-unavailable"
            statusLabel.accessibilityIdentifier = "deferred-work-simulator-unavailable"
        } else if report["request_survived_background_cycle"] as? Bool == true {
            statusLabel.text = "pending-after-background"
            statusLabel.accessibilityIdentifier = "deferred-work-pending-after-background"
        } else if report["submitted"] as? Bool == true && (report["pending_count"] as? Int ?? 0) == 1 {
            statusLabel.text = "pending"
            statusLabel.accessibilityIdentifier = "deferred-work-pending"
        } else {
            statusLabel.text = report["last_error"] as? String ?? "ready"
            statusLabel.accessibilityIdentifier = "deferred-work-ready"
        }
    }

    private static func writeReport(_ report: [String: Any]) {
        guard let data = try? JSONSerialization.data(withJSONObject: report, options: [.prettyPrinted, .sortedKeys]) else { return }
        let documents = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask).first!
        try? data.write(to: documents.appendingPathComponent("wasmc-ios-deferred-work.json"), options: .atomic)
    }

    deinit { NotificationCenter.default.removeObserver(self) }
}
