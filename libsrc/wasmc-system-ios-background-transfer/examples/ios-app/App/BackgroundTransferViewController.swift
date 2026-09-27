import UIKit

final class BackgroundTransferViewController: UIViewController {
    private let provider: BackgroundTransferProvider
    private let providerEvidence: [[String: Any]]
    private let titleLabel = UILabel()
    private let statusLabel = UILabel()
    private let startButton = UIButton(type: .system)

    init(provider: BackgroundTransferProvider, providerEvidence: [[String: Any]]) {
        self.provider = provider
        self.providerEvidence = providerEvidence
        super.init(nibName: nil, bundle: nil)
    }

    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = UIColor(red: 0.04, green: 0.06, blue: 0.11, alpha: 1)
        titleLabel.text = "iOS 后台传输实验"
        titleLabel.textColor = .white
        titleLabel.font = .systemFont(ofSize: 26, weight: .bold)
        titleLabel.accessibilityIdentifier = "background-transfer-title"
        statusLabel.textColor = UIColor(red: 0.40, green: 0.90, blue: 0.66, alpha: 1)
        statusLabel.font = .monospacedSystemFont(ofSize: 15, weight: .semibold)
        statusLabel.numberOfLines = 0
        startButton.setTitle("开始后台下载", for: .normal)
        startButton.setTitleColor(.white, for: .normal)
        startButton.backgroundColor = UIColor(red: 0.30, green: 0.38, blue: 0.92, alpha: 1)
        startButton.layer.cornerRadius = 16
        startButton.accessibilityIdentifier = "background-transfer-start"
        startButton.addAction(UIAction { [weak self] _ in self?.start() }, for: .touchUpInside)
        [titleLabel, statusLabel, startButton].forEach(view.addSubview)
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(refresh),
            name: BackgroundTransferProvider.didChange,
            object: provider
        )
        refresh()
    }

    override func viewDidLayoutSubviews() {
        super.viewDidLayoutSubviews()
        let width = view.bounds.width - 40
        titleLabel.frame = CGRect(x: 20, y: view.safeAreaInsets.top + 36, width: width, height: 36)
        startButton.frame = CGRect(x: 20, y: titleLabel.frame.maxY + 28, width: width, height: 54)
        statusLabel.frame = CGRect(x: 20, y: startButton.frame.maxY + 24, width: width, height: 140)
    }

    private func start() {
        guard let url = URL(string: "http://127.0.0.1:18765/payload.bin") else { return }
        startButton.isEnabled = false
        _ = provider.start(url: url)
        refresh()
    }

    @objc private func refresh() {
        var report = provider.report()
        report["provider_evidence"] = providerEvidence
        Self.writeReport(report)
        if report["accepted"] as? Bool == true {
            statusLabel.text = "background-transfer:accepted\nbytes=\(report["bytes"] ?? 0)"
            statusLabel.accessibilityIdentifier = "background-transfer-complete"
        } else {
            statusLabel.text = "等待后台传输"
            statusLabel.accessibilityIdentifier = "background-transfer-pending"
        }
    }

    private static func writeReport(_ report: [String: Any]) {
        guard let data = try? JSONSerialization.data(withJSONObject: report, options: [.prettyPrinted, .sortedKeys]) else { return }
        let documents = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask).first!
        try? data.write(to: documents.appendingPathComponent("wasmc-ios-background-transfer.json"), options: .atomic)
    }

    deinit { NotificationCenter.default.removeObserver(self) }
}
