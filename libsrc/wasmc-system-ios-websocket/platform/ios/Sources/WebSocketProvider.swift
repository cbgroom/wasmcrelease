import Foundation
import UIKit

final class WebSocketProvider: NSObject, URLSessionWebSocketDelegate {
    static let didChange = Notification.Name("wasmc.websocket.did-change")
    private let queue = DispatchQueue(label: "io.wasmc.websocket.state")
    private var session: URLSession!
    private var task: URLSessionWebSocketTask?
    private var backgroundTask = UIBackgroundTaskIdentifier.invalid
    private var state: [String: Any] = [
        "connected": false,
        "foreground_send": false,
        "foreground_receive": false,
        "background_send": false,
        "background_receive": false,
        "foreground_reply": "",
        "background_reply": "",
        "background_receive_phase": "",
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
            "provider": "wasmc:system-ios-websocket@0.0.1-dev.1",
            "transport": "URLSessionWebSocketTask",
            "background_scope": "finite-background-task-only",
        ], options: [.sortedKeys])
    }

    func connect() {
        guard let url = URL(string: "ws://127.0.0.1:18766/wasmc") else { return }
        let task = session.webSocketTask(with: url)
        self.task = task
        task.resume()
        receiveNext()
        task.send(.string("client-foreground")) { [weak self] error in
            guard let self else { return }
            self.queue.sync {
                self.state["foreground_send"] = error == nil
                if let error { self.state["error"] = String(describing: error) }
            }
            self.publish()
        }
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
                    if let error { self.state["error"] = String(describing: error) }
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
        let accepted = (snapshot["connected"] as? Bool) == true
            && (snapshot["foreground_send"] as? Bool) == true
            && (snapshot["foreground_receive"] as? Bool) == true
            && (snapshot["background_send"] as? Bool) == true
            && (snapshot["background_receive"] as? Bool) == true
            && (snapshot["foreground_reply"] as? String) == "server-foreground"
            && (snapshot["background_reply"] as? String) == "server-background"
            && (snapshot["background_receive_phase"] as? String) == "background"
        snapshot["schema"] = "wasmc.ios-websocket-qualification/v1"
        snapshot["accepted"] = accepted
        snapshot["wss_qualified"] = false
        snapshot["internet_route_qualified"] = false
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
        queue.sync { state["connected"] = true }
        publish()
    }

    private func receiveNext() {
        task?.receive { [weak self] result in
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
                    }
                }
                self.publish()
                self.receiveNext()
            case .success(.data):
                self.receiveNext()
            case .failure(let error):
                self.queue.sync { self.state["error"] = String(describing: error) }
                self.publish()
            @unknown default:
                break
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
