import UIKit

final class BackgroundAudioViewController: UIViewController {
    private let provider: BackgroundAudioProvider
    private let providerEvidence: [[String: Any]]
    private let titleLabel = UILabel()
    private let statusLabel = UILabel()
    private let startButton = UIButton(type: .system)

    init(provider: BackgroundAudioProvider, providerEvidence: [[String: Any]]) {
        self.provider = provider
        self.providerEvidence = providerEvidence
        super.init(nibName: nil, bundle: nil)
    }
    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = UIColor(red: 0.04, green: 0.06, blue: 0.11, alpha: 1)
        titleLabel.text = "iOS 后台音频实验"
        titleLabel.textColor = .white
        titleLabel.font = .systemFont(ofSize: 26, weight: .bold)
        titleLabel.accessibilityIdentifier = "background-audio-title"
        statusLabel.textColor = UIColor(red: 0.40, green: 0.90, blue: 0.66, alpha: 1)
        statusLabel.numberOfLines = 0
        startButton.setTitle("开始 Playback", for: .normal)
        startButton.accessibilityIdentifier = "background-audio-start"
        startButton.addAction(UIAction { [weak self] _ in self?.provider.start() }, for: .touchUpInside)
        [titleLabel, statusLabel, startButton].forEach(view.addSubview)
        NotificationCenter.default.addObserver(
            self, selector: #selector(refresh), name: BackgroundAudioProvider.didChange, object: provider
        )
        refresh()
    }

    override func viewDidLayoutSubviews() {
        super.viewDidLayoutSubviews()
        let width = view.bounds.width - 40
        titleLabel.frame = CGRect(x: 20, y: view.safeAreaInsets.top + 36, width: width, height: 36)
        startButton.frame = CGRect(x: 20, y: titleLabel.frame.maxY + 28, width: width, height: 54)
        statusLabel.frame = CGRect(x: 20, y: startButton.frame.maxY + 24, width: width, height: 150)
    }

    @objc private func refresh() {
        var report = provider.report()
        report["provider_evidence"] = providerEvidence
        Self.writeReport(report)
        if report["accepted"] as? Bool == true {
            statusLabel.text = "background-audio:accepted\ndelta=\(report["background_position_delta_ms"] ?? 0)ms"
            statusLabel.accessibilityIdentifier = "background-audio-complete"
        } else {
            statusLabel.text = "等待后台播放"
            statusLabel.accessibilityIdentifier = "background-audio-pending"
        }
    }

    private static func writeReport(_ report: [String: Any]) {
        guard let data = try? JSONSerialization.data(withJSONObject: report, options: [.prettyPrinted, .sortedKeys]) else { return }
        let documents = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask).first!
        try? data.write(to: documents.appendingPathComponent("wasmc-ios-background-audio.json"), options: .atomic)
    }

    deinit { NotificationCenter.default.removeObserver(self) }
}
