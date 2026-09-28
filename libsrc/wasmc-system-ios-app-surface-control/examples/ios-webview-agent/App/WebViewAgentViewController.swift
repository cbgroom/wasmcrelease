import UIKit
import WebKit

final class WebViewAgentViewController: UIViewController {
    private let provider = WebViewSurfaceProvider()
    private let providerEvidence: [[String: Any]]
    private let titleLabel = UILabel()
    private let startButton = UIButton(type: .system)
    private let verifyButton = UIButton(type: .system)
    private let statusLabel = UILabel()
    private let agentWebView = WKWebView(frame: .zero)
    private let userWebView = WKWebView(frame: .zero)
    private var beforeAgent: [String: Any] = [:]
    private var beforeUser: [String: Any] = [:]
    private var afterAgent: [String: Any] = [:]
    private var afterUser: [String: Any] = [:]
    private var actionReceipt: [String: Any] = [:]

    init(providerEvidence: [[String: Any]]) {
        self.providerEvidence = providerEvidence
        super.init(nibName: nil, bundle: nil)
    }
    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = UIColor(red: 0.04, green: 0.05, blue: 0.09, alpha: 1)
        titleLabel.text = "双 WKWebView Agent Lab"
        titleLabel.textColor = .white
        titleLabel.font = .systemFont(ofSize: 24, weight: .bold)
        titleLabel.accessibilityIdentifier = "web-agent-title"
        startButton.setTitle("开始并行操作", for: .normal)
        startButton.accessibilityIdentifier = "web-agent-start"
        startButton.addAction(UIAction { [weak self] _ in self?.startParallelAction() }, for: .touchUpInside)
        verifyButton.setTitle("验证隔离", for: .normal)
        verifyButton.accessibilityIdentifier = "web-agent-verify"
        verifyButton.addAction(UIAction { [weak self] _ in self?.verify() }, for: .touchUpInside)
        statusLabel.textColor = .systemGreen
        statusLabel.numberOfLines = 0
        agentWebView.accessibilityIdentifier = "web-agent-surface"
        userWebView.accessibilityIdentifier = "web-user-surface"
        [titleLabel, startButton, verifyButton, statusLabel, agentWebView, userWebView].forEach(view.addSubview)
        provider.register(surfaceID: "web-agent", webView: agentWebView)
        provider.register(surfaceID: "web-user", webView: userWebView)
        agentWebView.loadHTMLString(Self.page(title: "Agent Surface"), baseURL: nil)
        userWebView.loadHTMLString(Self.page(title: "User Surface"), baseURL: nil)
    }

    override func viewDidLayoutSubviews() {
        super.viewDidLayoutSubviews()
        let safeTop = view.safeAreaInsets.top
        titleLabel.frame = CGRect(x: 16, y: safeTop + 8, width: view.bounds.width - 32, height: 32)
        startButton.frame = CGRect(x: 16, y: titleLabel.frame.maxY + 4, width: 150, height: 36)
        verifyButton.frame = CGRect(x: 176, y: titleLabel.frame.maxY + 4, width: 120, height: 36)
        statusLabel.frame = CGRect(x: 306, y: titleLabel.frame.maxY + 4, width: view.bounds.width - 322, height: 36)
        let top = startButton.frame.maxY + 8
        let gap: CGFloat = 10
        let width = (view.bounds.width - 32 - gap) / 2
        let height = view.bounds.height - top - view.safeAreaInsets.bottom - 12
        agentWebView.frame = CGRect(x: 16, y: top, width: width, height: height)
        userWebView.frame = CGRect(x: agentWebView.frame.maxX + gap, y: top, width: width, height: height)
    }

    private func startParallelAction() {
        provider.semanticSnapshot(surfaceID: "web-agent") { [weak self] result in
            if case .success(let snapshot) = result { self?.beforeAgent = snapshot }
        }
        provider.semanticSnapshot(surfaceID: "web-user") { [weak self] result in
            if case .success(let snapshot) = result { self?.beforeUser = snapshot }
        }
        DispatchQueue.main.asyncAfter(deadline: .now() + 2.0) { [weak self] in
            guard let self else { return }
            self.provider.virtualActivate(
                surfaceID: "web-agent",
                expectedGeneration: 0,
                elementID: "increment"
            ) { result in
                guard case .success(var receipt) = result else { return }
                receipt["completed_unix_ms"] = Int(Date().timeIntervalSince1970 * 1000)
                self.actionReceipt = receipt
                self.provider.semanticSnapshot(surfaceID: "web-agent") {
                    if case .success(let snapshot) = $0 { self.afterAgent = snapshot }
                }
                self.provider.semanticSnapshot(surfaceID: "web-user") { result in
                    if case .success(let snapshot) = result { self.afterUser = snapshot }
                    self.statusLabel.text = "Agent定向动作完成"
                    self.statusLabel.accessibilityIdentifier = "web-agent-action-complete"
                }
            }
        }
    }

    private func verify() {
        provider.semanticSnapshot(surfaceID: "web-user") { [weak self] result in
            guard let self, case .success(let finalUser) = result else { return }
            self.provider.semanticSnapshot(surfaceID: "web-agent") { agentResult in
                guard case .success(let finalAgent) = agentResult else { return }
                let userText = Self.nodeText(finalUser, id: "note")
                let agentCount = Self.nodeText(finalAgent, id: "count")
                let userCount = Self.nodeText(finalUser, id: "count")
                let firstInput = finalUser["input_first_at"] as? Double ?? 0
                let lastInput = finalUser["input_last_at"] as? Double ?? 0
                let actionTime = Double(self.actionReceipt["completed_unix_ms"] as? Int ?? 0)
                let accepted = userText == "human-owned" && agentCount == "1" && userCount == "0" &&
                    firstInput > 0 && firstInput <= actionTime && actionTime <= lastInput &&
                    self.actionReceipt["surface_id"] as? String == "web-agent" &&
                    self.actionReceipt["physical_input_injection"] as? Bool == false &&
                    Self.nodeIDs(finalAgent) == ["count", "increment", "note"] &&
                    Self.nodeIDs(finalUser) == ["count", "increment", "note"]
                let report: [String: Any] = [
                    "schema": "wasmc.ios-webview-agent-qualification/v1",
                    "accepted": accepted,
                    "fixed_host_domain_apis": 0,
                    "surface_count": 2,
                    "real_wkwebview_surfaces": true,
                    "semantic_dom_snapshot": true,
                    "stable_element_ids": true,
                    "agent_uses_physical_input": self.provider.agentUsesPhysicalInput,
                    "agent_action_surface": self.actionReceipt["surface_id"] ?? "",
                    "agent_action_element": self.actionReceipt["element_id"] ?? "",
                    "agent_surface_count": agentCount,
                    "user_surface_count": userCount,
                    "user_text": userText,
                    "user_input_overlapped_agent_action": firstInput <= actionTime && actionTime <= lastInput,
                    "before_agent": self.beforeAgent,
                    "before_user": self.beforeUser,
                    "after_agent": self.afterAgent,
                    "after_user": self.afterUser,
                    "final_agent": finalAgent,
                    "final_user": finalUser,
                    "action_receipt": self.actionReceipt,
                    "provider_evidence": self.providerEvidence,
                    "physical_device": false,
                    "admitted": false,
                    "released": false,
                ]
                Self.writeReport(report)
                self.statusLabel.text = accepted ? "Web隔离验证通过" : "Web隔离验证失败"
                self.statusLabel.accessibilityIdentifier = accepted
                    ? "web-agent-qualification-complete" : "web-agent-qualification-failed"
            }
        }
    }

    private static func nodeText(_ snapshot: [String: Any], id: String) -> String {
        let nodes = snapshot["nodes"] as? [[String: Any]] ?? []
        return nodes.first { $0["id"] as? String == id }?["text"] as? String ?? ""
    }

    private static func nodeIDs(_ snapshot: [String: Any]) -> [String] {
        let nodes = snapshot["nodes"] as? [[String: Any]] ?? []
        return nodes.compactMap { $0["id"] as? String }.sorted()
    }

    private static func writeReport(_ report: [String: Any]) {
        guard let data = try? JSONSerialization.data(withJSONObject: report, options: [.prettyPrinted, .sortedKeys]) else { return }
        let documents = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask).first!
        try? data.write(to: documents.appendingPathComponent("wasmc-ios-webview-agent.json"), options: .atomic)
    }

    private static func page(title: String) -> String {
        """
        <!doctype html><meta name='viewport' content='width=device-width,initial-scale=1'>
        <style>body{font:18px -apple-system;padding:18px;background:#eef2ff}button,input{font-size:18px;padding:12px;margin:8px 0;width:90%}</style>
        <title>\(title)</title><h2>\(title)</h2>
        <div>Count: <span data-agent-id='count'>0</span></div>
        <button aria-label='increment counter' data-agent-id='increment' onclick="document.querySelector('[data-agent-id=count]').textContent=String(Number(document.querySelector('[data-agent-id=count]').textContent)+1)">Increment</button>
        <input aria-label='human note' data-agent-id='note' oninput="window.inputFirstAt=window.inputFirstAt||Date.now();window.inputLastAt=Date.now()" />
        <script>window.inputFirstAt=0;window.inputLastAt=0</script>
        """
    }
}
