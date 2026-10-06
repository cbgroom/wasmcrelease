import BackgroundTasks
import Foundation

final class DeferredWorkProvider {
    static let identifier = "io.wasmc.deferred-work.refresh"
    static let didChange = Notification.Name("wasmc.deferred-work.did-change")
    private let queue = DispatchQueue(label: "io.wasmc.deferred-work-state")
    private var registered = false
    private var submitted = false
    private var survivedBackgroundCycle = false
    private var cancelled = false
    private var lastError = ""
    private var lastErrorDomain = ""
    private var lastErrorCode = 0
    private var pendingCount = 0

    func descriptorProbe(_ input: Data) throws -> Data {
        precondition(input.isEmpty)
        return try JSONSerialization.data(withJSONObject: [
            "api": "wasmc:system-deferred-work@0.0.1",
            "provider": "wasmc:system-ios-deferred-work@0.0.1-dev.1",
            "scheduler": "BGTaskScheduler",
            "system_delivery_qualified": false,
        ], options: [.sortedKeys])
    }

    func register() {
        let accepted = BGTaskScheduler.shared.register(
            forTaskWithIdentifier: Self.identifier,
            using: nil
        ) { task in
            task.expirationHandler = { task.setTaskCompleted(success: false) }
            task.setTaskCompleted(success: true)
        }
        queue.sync { registered = accepted }
        notify()
    }

    func schedule() {
        let request = BGAppRefreshTaskRequest(identifier: Self.identifier)
        request.earliestBeginDate = Date(timeIntervalSinceNow: 60)
        do {
            try BGTaskScheduler.shared.submit(request)
            queue.sync {
                submitted = true
                lastError = ""
                lastErrorDomain = ""
                lastErrorCode = 0
            }
        } catch {
            let native = error as NSError
            queue.sync {
                submitted = false
                lastError = String(describing: error)
                lastErrorDomain = native.domain
                lastErrorCode = native.code
            }
        }
        refreshPending()
    }

    func markReturnedFromBackground() {
        BGTaskScheduler.shared.getPendingTaskRequests { [weak self] requests in
            guard let self else { return }
            self.queue.sync {
                self.pendingCount = requests.filter { $0.identifier == Self.identifier }.count
                self.survivedBackgroundCycle = self.pendingCount == 1
            }
            self.notify()
        }
    }

    func cancel() {
        BGTaskScheduler.shared.cancel(taskRequestWithIdentifier: Self.identifier)
        queue.sync { cancelled = true }
        refreshPending()
    }

    func report() -> [String: Any] {
        queue.sync {
            [
                "schema": "wasmc.ios-deferred-work-qualification/v1",
                "accepted": registered && submitted && survivedBackgroundCycle && cancelled && pendingCount == 0,
                "diagnostic_complete": registered && !submitted &&
                    lastErrorDomain == "BGTaskSchedulerErrorDomain" && lastErrorCode == 1,
                "registered": registered,
                "submitted": submitted,
                "pending_count": pendingCount,
                "request_survived_background_cycle": survivedBackgroundCycle,
                "cancelled": cancelled,
                "last_error": lastError,
                "last_error_domain": lastErrorDomain,
                "last_error_code": lastErrorCode,
                "system_delivery_qualified": false,
                "expiration_qualified": false,
                "terminated_app_relaunch_qualified": false,
                "physical_device": false,
                "admitted": false,
                "released": false,
            ]
        }
    }

    private func refreshPending() {
        BGTaskScheduler.shared.getPendingTaskRequests { [weak self] requests in
            guard let self else { return }
            self.queue.sync {
                self.pendingCount = requests.filter { $0.identifier == Self.identifier }.count
            }
            self.notify()
        }
    }

    private func notify() {
        DispatchQueue.main.async {
            NotificationCenter.default.post(name: Self.didChange, object: self)
        }
    }
}
