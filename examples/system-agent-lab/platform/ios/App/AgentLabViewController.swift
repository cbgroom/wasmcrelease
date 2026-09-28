import UIKit
import WebKit

final class AgentLabViewController: UIViewController, WKNavigationDelegate {
    private let webProvider: WebViewSurfaceProvider
    private let networkProvider: NetworkPathProvider
    private let providerEvidence: [[String: Any]]
    private let titleLabel = UILabel()
    private let stateLabel = UILabel()
    private let webView = WKWebView(frame: .zero)
    private var webAccepted = false
    private var networkAccepted = false
    private var webSnapshot: [String: Any] = [:]

    init(
        webProvider: WebViewSurfaceProvider,
        networkProvider: NetworkPathProvider,
        providerEvidence: [[String: Any]]
    ) {
        self.webProvider = webProvider
        self.networkProvider = networkProvider
        self.providerEvidence = providerEvidence
        super.init(nibName: nil, bundle: nil)
    }
    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = UIColor(red: 0.04, green: 0.05, blue: 0.09, alpha: 1)
        titleLabel.text = "WAsmC System Agent Lab"
        titleLabel.textColor = .white
        titleLabel.font = .systemFont(ofSize: 24, weight: .bold)
        titleLabel.accessibilityIdentifier = "system-agent-lab-title"
        stateLabel.text = "等待组合场景"
        stateLabel.textColor = .systemGreen
        stateLabel.numberOfLines = 0
        webView.navigationDelegate = self
        webView.accessibilityIdentifier = "system-agent-lab-web-surface"
        [titleLabel, stateLabel, webView].forEach(view.addSubview)
        webProvider.register(surfaceID: "integrated-web", webView: webView)
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(networkChanged),
            name: NetworkPathProvider.didChange,
            object: networkProvider
        )
        webView.loadHTMLString(Self.page, baseURL: nil)
        networkChanged()
    }

    override func viewDidLayoutSubviews() {
        super.viewDidLayoutSubviews()
        let top = view.safeAreaInsets.top
        titleLabel.frame = CGRect(x: 20, y: top + 18, width: view.bounds.width - 40, height: 34)
        stateLabel.frame = CGRect(x: 20, y: titleLabel.frame.maxY + 8, width: view.bounds.width - 40, height: 66)
        webView.frame = CGRect(
            x: 20,
            y: stateLabel.frame.maxY + 8,
            width: view.bounds.width - 40,
            height: view.bounds.height - stateLabel.frame.maxY - view.safeAreaInsets.bottom - 28
        )
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        webProvider.virtualActivate(
            surfaceID: "integrated-web",
            expectedGeneration: 0,
            elementID: "increment"
        ) { [weak self] result in
            guard let self, case .success(let receipt) = result,
                  receipt["accepted"] as? Bool == true else { return }
            self.webProvider.semanticSnapshot(surfaceID: "integrated-web") { snapshotResult in
                guard case .success(let snapshot) = snapshotResult else { return }
                self.webSnapshot = snapshot
                self.webAccepted = Self.nodeText(snapshot, id: "count") == "1"
                    && snapshot["generation"] as? UInt64 == 1
                self.finishIfReady()
            }
        }
    }

    @objc private func networkChanged() {
        networkAccepted = networkProvider.report()["accepted"] as? Bool == true
        finishIfReady()
    }

    private func finishIfReady() {
        guard webAccepted && networkAccepted else { return }
        let network = networkProvider.report()
        let identities = providerEvidence.compactMap { $0["identity"] as? String }.sorted()
        let accepted = identities == [
            "wasmc:system-ios-app-surface-control@0.0.3-dev.1",
            "wasmc:system-ios-network-path@0.0.1-dev.1",
        ] && network["status"] as? String == "satisfied"
        let report: [String: Any] = [
            "schema": "wasmc.ios-system-agent-lab-qualification/v1",
            "accepted": accepted,
            "composition": "ios-system-agent-lab-v1",
            "fixed_host_domain_apis": 0,
            "provider_count": providerEvidence.count,
            "provider_identities": identities,
            "web_generation": webSnapshot["generation"] ?? 0,
            "web_count": Self.nodeText(webSnapshot, id: "count"),
            "network_status": network["status"] ?? "unknown",
            "network_generation": network["generation"] ?? 0,
            "provider_evidence": providerEvidence,
            "qualified": accepted,
            "admitted": false,
            "released": false,
            "discoverable": false,
            "installable": false,
        ]
        Self.writeReport(report)
        stateLabel.text = accepted ? "双 Lib 组合验证通过" : "双 Lib 组合验证失败"
        stateLabel.accessibilityIdentifier = accepted
            ? "system-agent-lab-complete" : "system-agent-lab-failed"
    }

    private static func nodeText(_ snapshot: [String: Any], id: String) -> String {
        let nodes = snapshot["nodes"] as? [[String: Any]] ?? []
        return nodes.first { $0["id"] as? String == id }?["text"] as? String ?? ""
    }

    private static func writeReport(_ report: [String: Any]) {
        guard let data = try? JSONSerialization.data(
            withJSONObject: report,
            options: [.prettyPrinted, .sortedKeys]
        ) else { return }
        let documents = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask).first!
        try? data.write(to: documents.appendingPathComponent("wasmc-ios-system-agent-lab.json"), options: .atomic)
    }

    private static let page = """
    <!doctype html><meta name='viewport' content='width=device-width,initial-scale=1'>
    <style>body{font:20px -apple-system;padding:22px;background:#eef2ff}button{font-size:20px;padding:14px;width:90%}</style>
    <title>Integrated Web Surface</title>
    <h2>Integrated Web Surface</h2>
    <div>Count: <span data-agent-id='count'>0</span></div>
    <button data-agent-id='increment' onclick="document.querySelector('[data-agent-id=count]').textContent='1'">Run semantic action</button>
    """

    deinit { NotificationCenter.default.removeObserver(self) }
}

