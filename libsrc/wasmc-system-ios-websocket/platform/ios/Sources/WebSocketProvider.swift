import CryptoKit
import Foundation
import Security
import UIKit

final class WebSocketProvider: NSObject, URLSessionWebSocketDelegate {
    static let didChange = Notification.Name("wasmc.websocket.did-change")
    private let queue = DispatchQueue(label: "io.wasmc.websocket.state")
    private var session: URLSession!
    private var task: URLSessionWebSocketTask?
    private var backgroundTask = UIBackgroundTaskIdentifier.invalid
    private let secureMode = ProcessInfo.processInfo.arguments.contains("--wasmc-wss")
    private let rejectFixturePin = ProcessInfo.processInfo.arguments.contains("--wasmc-wss-wrong-pin")
    private let recoveryMode = ProcessInfo.processInfo.arguments.contains("--wasmc-wss-recovery")
    private var reconnectScheduled = false
    private var interruptionRecorded = false
    private let maxReconnectAttempts = 8
    private static let fixtureCertificateSHA256 = "f115cf8cfd0c513ba2301bfe8b45c0de198de875ba24db0a79fc85362e611572"
    private var state: [String: Any] = [
        "connected": false,
        "foreground_send": false,
        "foreground_receive": false,
        "background_send": false,
        "background_receive": false,
        "foreground_reply": "",
        "background_reply": "",
        "background_receive_phase": "",
        "tls_server_trust_challenge": false,
        "certificate_pin_match": false,
        "certificate_sha256": "",
        "connection_generation": 0,
        "reconnect_attempts": 0,
        "reconnect_exhausted": false,
        "recovery_prime_receive": false,
        "service_interruption_observed": false,
        "outbox_enqueued": false,
        "outbox_delivered": false,
        "recovery_reply": "",
        "error": "",
    ]

    override init() {
        super.init()
        session = URLSession(configuration: .default, delegate: self, delegateQueue: nil)
    }

    func descriptorProbe(_ input: Data) throws -> Data {
        precondition(input.isEmpty)
        return try JSONSerialization.data(withJSONObject: [
            "api": "wasmc:system-websocket@0.0.1",
            "provider": "wasmc:system-ios-websocket@0.0.1-dev.3",
            "transport": "URLSessionWebSocketTask",
            "background_scope": "finite-background-task-only",
            "local_pinned_wss": true,
            "service_restart_reconnect": true,
            "reconnect_policy": "350ms-fixed-max-8",
        ], options: [.sortedKeys])
    }

    func connect() {
        openSocket()
    }

    private func openSocket() {
        let endpoint = secureMode
            ? "wss://127.0.0.1:18767/wasmc"
            : "ws://127.0.0.1:18766/wasmc"
        guard let url = URL(string: endpoint) else { return }
        let task = session.webSocketTask(with: url)
        self.task = task
        task.resume()
        receiveNext(task)
    }

    func didEnterBackground(_ application: UIApplication) {
        backgroundTask = application.beginBackgroundTask(withName: "wasmc.websocket-duplex") { [weak self] in
            guard let self else { return }
            self.queue.sync { self.state["error"] = "finite-background-task-expired" }
            self.finishBackgroundTask(application)
            self.publish()
        }
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.5) { [weak self] in
            guard let self, let task = self.task else { return }
            task.send(.string("client-background")) { [weak self] error in
                guard let self else { return }
                self.queue.sync {
                    self.state["background_send"] = error == nil
                    if let error, self.state["error"] as? String != "certificate-pin-mismatch" {
                        self.state["error"] = String(describing: error)
                    }
                }
                self.publish()
            }
        }
    }

    func willEnterForeground(_ application: UIApplication) {
        finishBackgroundTask(application)
        publish()
    }

    func report() -> [String: Any] {
        var snapshot = queue.sync { state }
        let duplexAccepted = (snapshot["connected"] as? Bool) == true
            && (snapshot["foreground_send"] as? Bool) == true
            && (snapshot["foreground_receive"] as? Bool) == true
            && (snapshot["background_send"] as? Bool) == true
            && (snapshot["background_receive"] as? Bool) == true
            && (snapshot["foreground_reply"] as? String) == "server-foreground"
            && (snapshot["background_reply"] as? String) == "server-background"
            && (snapshot["background_receive_phase"] as? String) == "background"
            && (!secureMode || (snapshot["certificate_pin_match"] as? Bool) == true)
        let recoveryAccepted = (snapshot["connected"] as? Bool) == true
            && (snapshot["connection_generation"] as? Int ?? 0) >= 2
            && (snapshot["recovery_prime_receive"] as? Bool) == true
            && (snapshot["service_interruption_observed"] as? Bool) == true
            && (snapshot["outbox_enqueued"] as? Bool) == true
            && (snapshot["outbox_delivered"] as? Bool) == true
            && (snapshot["recovery_reply"] as? String) == "server-after-restart"
            && (snapshot["certificate_pin_match"] as? Bool) == true
        let accepted = recoveryMode ? recoveryAccepted : duplexAccepted
        snapshot["schema"] = "wasmc.ios-websocket-qualification/v1"
        snapshot["accepted"] = accepted
        snapshot["secure_mode"] = secureMode
        snapshot["local_pinned_wss_qualified"] = secureMode
            && (snapshot["certificate_pin_match"] as? Bool) == true
            && accepted
        snapshot["service_restart_reconnect_qualified"] = recoveryMode && recoveryAccepted
        snapshot["public_ca_wss_qualified"] = false
        snapshot["internet_route_qualified"] = false
        snapshot["network_transition_reconnect_qualified"] = false
        snapshot["suspension_receive_qualified"] = false
        snapshot["process_relaunch_reconnect_qualified"] = false
        snapshot["physical_device"] = false
        snapshot["admitted"] = false
        snapshot["released"] = false
        return snapshot
    }

    func urlSession(
        _ session: URLSession,
        webSocketTask: URLSessionWebSocketTask,
        didOpenWithProtocol protocol: String?
    ) {
        let generation = queue.sync { () -> Int in
            state["connected"] = true
            state["error"] = ""
            let next = (state["connection_generation"] as? Int ?? 0) + 1
            state["connection_generation"] = next
            return next
        }
        publish()
        if recoveryMode {
            if generation == 1 {
                send("client-recovery-prime", using: webSocketTask, stateKey: nil)
            } else {
                send("client-after-restart", using: webSocketTask, stateKey: "outbox_delivered")
            }
        } else {
            send("client-foreground", using: webSocketTask, stateKey: "foreground_send")
        }
    }

    func urlSession(
        _ session: URLSession,
        webSocketTask: URLSessionWebSocketTask,
        didCloseWith closeCode: URLSessionWebSocketTask.CloseCode,
        reason: Data?
    ) {
        handleInterruption(webSocketTask)
    }

    func urlSession(
        _ session: URLSession,
        didReceive challenge: URLAuthenticationChallenge,
        completionHandler: @escaping (URLSession.AuthChallengeDisposition, URLCredential?) -> Void
    ) {
        guard secureMode,
              challenge.protectionSpace.authenticationMethod == NSURLAuthenticationMethodServerTrust,
              let trust = challenge.protectionSpace.serverTrust,
              let certificateChain = SecTrustCopyCertificateChain(trust) as? [SecCertificate],
              let certificate = certificateChain.first else {
            completionHandler(.performDefaultHandling, nil)
            return
        }
        let data = SecCertificateCopyData(certificate) as Data
        let digest = SHA256.hash(data: data).map { String(format: "%02x", $0) }.joined()
        let expected = rejectFixturePin ? String(repeating: "0", count: 64) : Self.fixtureCertificateSHA256
        let matched = digest == expected
        queue.sync {
            state["tls_server_trust_challenge"] = true
            state["certificate_sha256"] = digest
            state["certificate_pin_match"] = matched
            if !matched { state["error"] = "certificate-pin-mismatch" }
        }
        publish()
        if matched {
            completionHandler(.useCredential, URLCredential(trust: trust))
        } else {
            completionHandler(.cancelAuthenticationChallenge, nil)
        }
    }

    private func receiveNext(_ activeTask: URLSessionWebSocketTask) {
        activeTask.receive { [weak self] result in
            guard let self else { return }
            switch result {
            case .success(.string(let message)):
                let phase = Self.phaseName(UIApplication.shared.applicationState)
                self.queue.sync {
                    if message == "server-foreground" {
                        self.state["foreground_receive"] = true
                        self.state["foreground_reply"] = message
                    } else if message == "server-background" {
                        self.state["background_receive"] = true
                        self.state["background_reply"] = message
                        self.state["background_receive_phase"] = phase
                    } else if message == "server-recovery-prime" {
                        self.state["recovery_prime_receive"] = true
                    } else if message == "server-after-restart" {
                        self.state["outbox_delivered"] = true
                        self.state["recovery_reply"] = message
                    }
                }
                self.publish()
                self.receiveNext(activeTask)
            case .success(.data):
                self.receiveNext(activeTask)
            case .failure(let error):
                self.queue.sync {
                    if self.state["error"] as? String != "certificate-pin-mismatch" {
                        self.state["error"] = String(describing: error)
                    }
                }
                self.publish()
                self.handleInterruption(activeTask)
            @unknown default:
                break
            }
        }
    }

    private func send(_ message: String, using activeTask: URLSessionWebSocketTask, stateKey: String?) {
        activeTask.send(.string(message)) { [weak self] error in
            guard let self else { return }
            self.queue.sync {
                if let stateKey { self.state[stateKey] = error == nil }
                if let error, self.state["error"] as? String != "certificate-pin-mismatch" {
                    self.state["error"] = String(describing: error)
                }
            }
            self.publish()
            if error != nil { self.handleInterruption(activeTask) }
        }
    }

    private func handleInterruption(_ activeTask: URLSessionWebSocketTask) {
        guard recoveryMode, activeTask === task else { return }
        queue.sync {
            state["connected"] = false
            if !interruptionRecorded {
                interruptionRecorded = true
                state["service_interruption_observed"] = true
                state["outbox_enqueued"] = true
            }
        }
        publish()
        scheduleReconnect()
    }

    private func scheduleReconnect() {
        DispatchQueue.main.async { [weak self] in
            guard let self, !self.reconnectScheduled else { return }
            self.reconnectScheduled = true
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.35) { [weak self] in
                guard let self else { return }
                self.reconnectScheduled = false
                let complete = self.queue.sync { self.state["outbox_delivered"] as? Bool == true }
                guard !complete else { return }
                let shouldRetry = self.queue.sync { () -> Bool in
                    let attempts = self.state["reconnect_attempts"] as? Int ?? 0
                    guard attempts < self.maxReconnectAttempts else {
                        self.state["reconnect_exhausted"] = true
                        return false
                    }
                    self.state["reconnect_attempts"] = attempts + 1
                    return true
                }
                guard shouldRetry else {
                    self.publish()
                    return
                }
                self.openSocket()
            }
        }
    }

    private func finishBackgroundTask(_ application: UIApplication) {
        guard backgroundTask != .invalid else { return }
        application.endBackgroundTask(backgroundTask)
        backgroundTask = .invalid
    }

    private func publish() {
        DispatchQueue.main.async { NotificationCenter.default.post(name: Self.didChange, object: self) }
    }

    private static func phaseName(_ state: UIApplication.State) -> String {
        switch state {
        case .active: return "active"
        case .background: return "background"
        case .inactive: return "inactive"
        @unknown default: return "unknown"
        }
    }
}
