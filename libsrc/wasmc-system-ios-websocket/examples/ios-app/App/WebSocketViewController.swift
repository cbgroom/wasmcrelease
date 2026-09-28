import UIKit

final class WebSocketViewController: UIViewController {
    private let provider: WebSocketProvider
    private let providerEvidence: [[String: Any]]
    private let titleLabel = UILabel()
    private let statusLabel = UILabel()
    private let connectButton = UIButton(type: .system)

    init(provider: WebSocketProvider, providerEvidence: [[String: Any]]) {
        self.provider = provider
        self.providerEvidence = providerEvidence
        super.init(nibName: nil, bundle: nil)
    }
    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = UIColor(red: 0.04, green: 0.06, blue: 0.11, alpha: 1)
        titleLabel.text = "iOS WebSocket 双通实验"
        titleLabel.textColor = .white
        titleLabel.font = .systemFont(ofSize: 25, weight: .bold)
        titleLabel.accessibilityIdentifier = "websocket-title"
        statusLabel.textColor = UIColor(red: 0.40, green: 0.90, blue: 0.66, alpha: 1)
        statusLabel.numberOfLines = 0
        connectButton.setTitle("连接并双向发送", for: .normal)
        connectButton.accessibilityIdentifier = "websocket-connect"
        connectButton.addAction(UIAction { [weak self] _ in self?.provider.connect() }, for: .touchUpInside)
        [titleLabel, statusLabel, connectButton].forEach(view.addSubview)
        NotificationCenter.default.addObserver(
            self, selector: #selector(refresh), name: WebSocketProvider.didChange, object: provider
        )
        refresh()
    }

    override func viewDidLayoutSubviews() {
        super.viewDidLayoutSubviews()
        let width = view.bounds.width - 40
        titleLabel.frame = CGRect(x: 20, y: view.safeAreaInsets.top + 36, width: width, height: 36)
        connectButton.frame = CGRect(x: 20, y: titleLabel.frame.maxY + 28, width: width, height: 54)
        statusLabel.frame = CGRect(x: 20, y: connectButton.frame.maxY + 24, width: width, height: 180)
    }

    @objc private func refresh() {
        var report = provider.report()
        report["provider_evidence"] = providerEvidence
        Self.writeReport(report)
        if report["accepted"] as? Bool == true {
            statusLabel.text = "websocket-background-duplex:accepted"
            statusLabel.accessibilityIdentifier = "websocket-complete"
        } else if (report["error"] as? String) == "certificate-pin-mismatch" {
            statusLabel.text = "websocket-certificate-pin:rejected"
            statusLabel.accessibilityIdentifier = "websocket-pin-rejected"
        } else if report["foreground_receive"] as? Bool == true {
            statusLabel.text = "websocket-foreground-duplex:ready"
            statusLabel.accessibilityIdentifier = "websocket-foreground-ready"
        } else {
            statusLabel.text = "等待连接"
            statusLabel.accessibilityIdentifier = "websocket-pending"
        }
    }

    private static func writeReport(_ report: [String: Any]) {
        guard let data = try? JSONSerialization.data(withJSONObject: report, options: [.prettyPrinted, .sortedKeys]) else { return }
        let documents = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask).first!
        try? data.write(to: documents.appendingPathComponent("wasmc-ios-websocket.json"), options: .atomic)
    }

    deinit { NotificationCenter.default.removeObserver(self) }
}
