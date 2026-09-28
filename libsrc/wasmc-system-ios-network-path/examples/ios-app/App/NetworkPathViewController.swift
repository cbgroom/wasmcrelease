import UIKit

final class NetworkPathViewController: UIViewController {
    private let provider: NetworkPathProvider
    private let providerEvidence: [[String: Any]]
    private let titleLabel = UILabel()
    private let statusLabel = UILabel()

    init(provider: NetworkPathProvider, providerEvidence: [[String: Any]]) {
        self.provider = provider
        self.providerEvidence = providerEvidence
        super.init(nibName: nil, bundle: nil)
    }
    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = UIColor(red: 0.04, green: 0.06, blue: 0.11, alpha: 1)
        titleLabel.text = "iOS 网络路径实验"
        titleLabel.textColor = .white
        titleLabel.font = .systemFont(ofSize: 26, weight: .bold)
        titleLabel.accessibilityIdentifier = "network-path-title"
        statusLabel.textColor = UIColor(red: 0.40, green: 0.90, blue: 0.66, alpha: 1)
        statusLabel.numberOfLines = 0
        [titleLabel, statusLabel].forEach(view.addSubview)
        NotificationCenter.default.addObserver(
            self, selector: #selector(refresh), name: NetworkPathProvider.didChange, object: provider
        )
        refresh()
    }

    override func viewDidLayoutSubviews() {
        super.viewDidLayoutSubviews()
        let width = view.bounds.width - 40
        titleLabel.frame = CGRect(x: 20, y: view.safeAreaInsets.top + 36, width: width, height: 36)
        statusLabel.frame = CGRect(x: 20, y: titleLabel.frame.maxY + 28, width: width, height: 180)
    }

    @objc private func refresh() {
        var report = provider.report()
        report["provider_evidence"] = providerEvidence
        Self.writeReport(report)
        if report["accepted"] as? Bool == true {
            statusLabel.text = "network-path:satisfied\ninterfaces=\(report["interfaces"] ?? [])"
            statusLabel.accessibilityIdentifier = "network-path-complete"
        } else {
            statusLabel.text = "等待系统路径"
            statusLabel.accessibilityIdentifier = "network-path-pending"
        }
    }

    private static func writeReport(_ report: [String: Any]) {
        guard let data = try? JSONSerialization.data(withJSONObject: report, options: [.prettyPrinted, .sortedKeys]) else { return }
        let documents = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask).first!
        try? data.write(to: documents.appendingPathComponent("wasmc-ios-network-path.json"), options: .atomic)
    }

    deinit { NotificationCenter.default.removeObserver(self) }
}
