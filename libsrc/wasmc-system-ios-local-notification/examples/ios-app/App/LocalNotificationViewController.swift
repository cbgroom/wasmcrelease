import UIKit

final class LocalNotificationViewController: UIViewController {
    private let provider: LocalNotificationProvider
    private let providerEvidence: [[String: Any]]
    private let titleLabel = UILabel()
    private let statusLabel = UILabel()
    private let scheduleButton = UIButton(type: .system)

    init(provider: LocalNotificationProvider, providerEvidence: [[String: Any]]) {
        self.provider = provider
        self.providerEvidence = providerEvidence
        super.init(nibName: nil, bundle: nil)
    }
    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = UIColor(red: 0.04, green: 0.06, blue: 0.11, alpha: 1)
        titleLabel.text = "iOS 本地通知实验"
        titleLabel.textColor = .white
        titleLabel.font = .systemFont(ofSize: 26, weight: .bold)
        titleLabel.accessibilityIdentifier = "local-notification-title"
        statusLabel.textColor = UIColor(red: 0.40, green: 0.90, blue: 0.66, alpha: 1)
        statusLabel.numberOfLines = 0
        scheduleButton.setTitle("授权并调度通知", for: .normal)
        scheduleButton.accessibilityIdentifier = "local-notification-schedule"
        scheduleButton.addAction(UIAction { [weak self] _ in self?.provider.requestAuthorizationAndSchedule() }, for: .touchUpInside)
        [titleLabel, statusLabel, scheduleButton].forEach(view.addSubview)
        NotificationCenter.default.addObserver(
            self, selector: #selector(refresh), name: LocalNotificationProvider.didChange, object: provider
        )
        refresh()
    }

    override func viewDidLayoutSubviews() {
        super.viewDidLayoutSubviews()
        let width = view.bounds.width - 40
        titleLabel.frame = CGRect(x: 20, y: view.safeAreaInsets.top + 36, width: width, height: 36)
        scheduleButton.frame = CGRect(x: 20, y: titleLabel.frame.maxY + 28, width: width, height: 54)
        statusLabel.frame = CGRect(x: 20, y: scheduleButton.frame.maxY + 24, width: width, height: 180)
    }

    @objc private func refresh() {
        var report = provider.report()
        report["provider_evidence"] = providerEvidence
        Self.writeReport(report)
        if report["accepted"] as? Bool == true {
            statusLabel.text = "local-notification:accepted\nexact payload delivered in background"
            statusLabel.accessibilityIdentifier = "local-notification-complete"
        } else if report["scheduled"] as? Bool == true {
            statusLabel.text = "local-notification:scheduled"
            statusLabel.accessibilityIdentifier = "local-notification-scheduled"
        } else {
            statusLabel.text = "等待授权和调度"
            statusLabel.accessibilityIdentifier = "local-notification-pending"
        }
    }

    private static func writeReport(_ report: [String: Any]) {
        guard let data = try? JSONSerialization.data(withJSONObject: report, options: [.prettyPrinted, .sortedKeys]) else { return }
        let documents = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask).first!
        try? data.write(to: documents.appendingPathComponent("wasmc-ios-local-notification.json"), options: .atomic)
    }

    deinit { NotificationCenter.default.removeObserver(self) }
}
