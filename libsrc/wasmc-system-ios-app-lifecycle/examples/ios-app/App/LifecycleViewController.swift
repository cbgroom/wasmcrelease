import UIKit

final class LifecycleViewController: UIViewController {
    private let provider: AppLifecycleProvider
    private let providerEvidence: [[String: Any]]
    private let titleLabel = UILabel()
    private let statusLabel = UILabel()
    private let detailLabel = UILabel()

    init(provider: AppLifecycleProvider, providerEvidence: [[String: Any]]) {
        self.provider = provider
        self.providerEvidence = providerEvidence
        super.init(nibName: nil, bundle: nil)
    }

    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = UIColor(red: 0.04, green: 0.06, blue: 0.11, alpha: 1)
        titleLabel.text = "iOS 后台生命周期实验"
        titleLabel.textColor = .white
        titleLabel.font = .systemFont(ofSize: 26, weight: .bold)
        titleLabel.accessibilityIdentifier = "lifecycle-title"
        statusLabel.textColor = UIColor(red: 0.40, green: 0.90, blue: 0.66, alpha: 1)
        statusLabel.font = .systemFont(ofSize: 19, weight: .semibold)
        detailLabel.textColor = UIColor.white.withAlphaComponent(0.68)
        detailLabel.font = .monospacedSystemFont(ofSize: 13, weight: .regular)
        detailLabel.numberOfLines = 0
        [titleLabel, statusLabel, detailLabel].forEach(view.addSubview)
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(journalDidChange),
            name: AppLifecycleProvider.journalDidChange,
            object: provider
        )
        refresh()
    }

    @objc private func journalDidChange() { refresh() }

    override func viewDidLayoutSubviews() {
        super.viewDidLayoutSubviews()
        let width = view.bounds.width - 40
        titleLabel.frame = CGRect(x: 20, y: view.safeAreaInsets.top + 30, width: width, height: 36)
        statusLabel.frame = CGRect(x: 20, y: titleLabel.frame.maxY + 24, width: width, height: 30)
        detailLabel.frame = CGRect(x: 20, y: statusLabel.frame.maxY + 18, width: width, height: 240)
    }

    func refresh() {
        var report = provider.report()
        report["provider_evidence"] = providerEvidence
        Self.writeReport(report)
        let accepted = report["accepted"] as? Bool == true
        let recovered = report["cold_relaunch_journal_recovered"] as? Bool == true
        if recovered && accepted {
            statusLabel.text = "cold-relaunch:accepted"
            statusLabel.accessibilityIdentifier = "cold-relaunch-complete"
        } else if accepted {
            statusLabel.text = "background-cycle:accepted"
            statusLabel.accessibilityIdentifier = "background-cycle-complete"
        } else {
            statusLabel.text = "等待 Home → 返回"
            statusLabel.accessibilityIdentifier = "background-cycle-pending"
        }
        detailLabel.text = [
            "launches=\(report["launch_count"] ?? 0)",
            "events=\(report["event_count"] ?? 0)",
            "background_ticks=\(report["finite_work_background_ticks"] ?? 0)",
            "suspension_qualified=false",
        ].joined(separator: "\n")
    }

    private static func writeReport(_ report: [String: Any]) {
        guard let data = try? JSONSerialization.data(withJSONObject: report, options: [.prettyPrinted, .sortedKeys]) else { return }
        let documents = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask).first!
        try? data.write(to: documents.appendingPathComponent("wasmc-ios-app-lifecycle.json"), options: .atomic)
    }

    deinit { NotificationCenter.default.removeObserver(self) }
}
