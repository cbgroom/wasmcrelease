import CryptoKit
import Foundation
import UIKit

final class BackgroundTransferProvider: NSObject, URLSessionDownloadDelegate {
    static let didChange = Notification.Name("wasmc.background-transfer.did-change")
    private let queue = DispatchQueue(label: "io.wasmc.background-transfer-journal")
    private let journalURL: URL
    private let resultURL: URL
    private var sequence: UInt64 = 0
    private var backgroundCompletionHandler: (() -> Void)?
    private lazy var session: URLSession = {
        let configuration = URLSessionConfiguration.background(
            withIdentifier: "io.wasmc.background-transfer.session"
        )
        configuration.sessionSendsLaunchEvents = true
        configuration.isDiscretionary = false
        configuration.allowsCellularAccess = true
        return URLSession(configuration: configuration, delegate: self, delegateQueue: nil)
    }()

    override init() {
        let support = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first!
        try? FileManager.default.createDirectory(at: support, withIntermediateDirectories: true)
        journalURL = support.appendingPathComponent("wasmc-ios-background-transfer.jsonl")
        resultURL = support.appendingPathComponent("wasmc-ios-background-transfer.bin")
        super.init()
        sequence = events().map { ($0["sequence"] as? NSNumber)?.uint64Value ?? 0 }.max() ?? 0
        _ = session
    }

    func descriptorProbe(_ input: Data) throws -> Data {
        precondition(input.isEmpty)
        return try JSONSerialization.data(withJSONObject: [
            "api": "wasmc:system-background-transfer@0.0.1",
            "provider": "wasmc:system-ios-background-transfer@0.0.1-dev.1",
            "transport": "URLSessionConfiguration.background",
            "durable_result": true,
            "process_relaunch_delivery_qualified": false,
        ], options: [.sortedKeys])
    }

    func reset() {
        queue.sync {
            try? FileManager.default.removeItem(at: journalURL)
            try? FileManager.default.removeItem(at: resultURL)
            sequence = 0
        }
    }

    @discardableResult
    func start(url: URL) -> Int {
        let task = session.downloadTask(with: url)
        record("download-created", taskID: task.taskIdentifier, values: ["url": url.absoluteString])
        task.resume()
        record("download-resumed", taskID: task.taskIdentifier)
        return task.taskIdentifier
    }

    func reconnect(completionHandler: @escaping () -> Void) {
        queue.sync { backgroundCompletionHandler = completionHandler }
        record("background-session-reconnected", taskID: 0)
    }

    func report() -> [String: Any] {
        let retained = events()
        let completion = retained.last { ($0["name"] as? String) == "download-completed" }
        let bytes = (completion?["bytes"] as? NSNumber)?.intValue ?? 0
        let digest = completion?["sha256"] as? String ?? ""
        let completionPhase = completion?["phase"] as? String ?? ""
        let data = try? Data(contentsOf: resultURL)
        let retainedDigest = data.map(Self.sha256) ?? ""
        return [
            "schema": "wasmc.ios-background-transfer-qualification/v1",
            "accepted": bytes > 0 && !digest.isEmpty && digest == retainedDigest && completionPhase == "background",
            "event_count": retained.count,
            "download_completed": completion != nil,
            "completion_phase": completionPhase,
            "bytes": bytes,
            "sha256": digest,
            "durable_result_present": data != nil,
            "durable_result_sha256": retainedDigest,
            "process_relaunch_delivery_qualified": false,
            "physical_device": false,
            "events": retained,
            "admitted": false,
            "released": false,
        ]
    }

    func urlSession(
        _ session: URLSession,
        downloadTask: URLSessionDownloadTask,
        didFinishDownloadingTo location: URL
    ) {
        do {
            let data = try Data(contentsOf: location)
            try data.write(to: resultURL, options: .atomic)
            record("download-completed", taskID: downloadTask.taskIdentifier, values: [
                "bytes": data.count,
                "sha256": Self.sha256(data),
            ])
        } catch {
            record("download-store-failed", taskID: downloadTask.taskIdentifier, values: [
                "error": String(describing: error),
            ])
        }
    }

    func urlSession(
        _ session: URLSession,
        task: URLSessionTask,
        didCompleteWithError error: Error?
    ) {
        record(error == nil ? "task-terminal-success" : "task-terminal-failure",
               taskID: task.taskIdentifier,
               values: error.map { ["error": String(describing: $0)] } ?? [:])
    }

    func urlSessionDidFinishEvents(forBackgroundURLSession session: URLSession) {
        record("background-events-finished", taskID: 0)
        let handler = queue.sync { () -> (() -> Void)? in
            defer { backgroundCompletionHandler = nil }
            return backgroundCompletionHandler
        }
        DispatchQueue.main.async { handler?() }
    }

    private func record(_ name: String, taskID: Int, values: [String: Any] = [:]) {
        let phase = Self.phaseName(UIApplication.shared.applicationState)
        queue.sync {
            sequence += 1
            var event: [String: Any] = [
                "sequence": sequence,
                "name": name,
                "task_id": taskID,
                "phase": phase,
                "monotonic_ns": DispatchTime.now().uptimeNanoseconds,
                "wall_time_ms": UInt64(Date().timeIntervalSince1970 * 1_000),
            ]
            values.forEach { event[$0.key] = $0.value }
            guard let data = try? JSONSerialization.data(withJSONObject: event, options: [.sortedKeys]) else { return }
            if !FileManager.default.fileExists(atPath: journalURL.path) {
                FileManager.default.createFile(atPath: journalURL.path, contents: nil)
            }
            guard let handle = try? FileHandle(forWritingTo: journalURL) else { return }
            defer { try? handle.close() }
            do {
                try handle.seekToEnd()
                try handle.write(contentsOf: data)
                try handle.write(contentsOf: Data([0x0a]))
                try handle.synchronize()
            } catch {}
        }
        DispatchQueue.main.async {
            NotificationCenter.default.post(name: Self.didChange, object: self)
        }
    }

    private func events() -> [[String: Any]] {
        queue.sync {
            guard let text = try? String(contentsOf: journalURL, encoding: .utf8) else { return [] }
            return text.split(separator: "\n").compactMap { line in
                guard let data = String(line).data(using: .utf8),
                      let value = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else { return nil }
                return value
            }
        }
    }

    private static func phaseName(_ state: UIApplication.State) -> String {
        switch state {
        case .active: return "active"
        case .background: return "background"
        case .inactive: return "inactive"
        @unknown default: return "unknown"
        }
    }

    private static func sha256(_ data: Data) -> String {
        SHA256.hash(data: data).map { String(format: "%02x", $0) }.joined()
    }
}
