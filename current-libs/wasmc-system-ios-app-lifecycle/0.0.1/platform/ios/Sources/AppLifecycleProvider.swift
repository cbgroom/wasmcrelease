import Foundation
import UIKit

final class AppLifecycleProvider {
    static let journalDidChange = Notification.Name("wasmc.app-lifecycle.journal-did-change")
    private let launchID = UUID().uuidString.lowercased()
    private let journalQueue = DispatchQueue(label: "io.wasmc.lifecycle-journal")
    private let workQueue = DispatchQueue(label: "io.wasmc.lifecycle-work", qos: .utility)
    private let journalURL: URL
    private var sequence: UInt64 = 0
    private var nextWorkID: UInt64 = 1
    private var workCancellation: [UInt64: Bool] = [:]
    private var backgroundTasks: [UInt64: UIBackgroundTaskIdentifier] = [:]
    private let finiteWorkDurationMilliseconds: UInt32

    init(resetJournal: Bool = false, finiteWorkDurationMilliseconds: UInt32 = 600) {
        self.finiteWorkDurationMilliseconds = finiteWorkDurationMilliseconds
        let support = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first!
        try? FileManager.default.createDirectory(at: support, withIntermediateDirectories: true)
        journalURL = support.appendingPathComponent("wasmc-ios-app-lifecycle.jsonl")
        if resetJournal { try? FileManager.default.removeItem(at: journalURL) }
        sequence = Self.readEvents(from: journalURL).map { ($0["sequence"] as? NSNumber)?.uint64Value ?? 0 }.max() ?? 0
    }

    func descriptorProbe(_ input: Data) throws -> Data {
        precondition(input.isEmpty)
        return try JSONSerialization.data(withJSONObject: [
            "api": "wasmc:system-app-lifecycle@0.0.1",
            "provider": "wasmc:system-ios-app-lifecycle@0.0.1-dev.1",
            "journal": "application-support-jsonl",
            "finite_background_work": true,
            "system_scheduling_guaranteed": false,
        ], options: [.sortedKeys])
    }

    func didFinishLaunching() { record("did-finish-launching", phase: .inactive) }
    func willResignActive() { record("will-resign-active", phase: .inactive) }

    func didEnterBackground(_ application: UIApplication) {
        record("did-enter-background", phase: .background)
        beginFiniteWork(
            application: application,
            label: "home-cycle",
            durationMilliseconds: finiteWorkDurationMilliseconds
        )
    }

    func willEnterForeground() { record("will-enter-foreground", phase: .inactive) }
    func didBecomeActive() { record("did-become-active", phase: .active) }
    func willTerminate() { record("will-terminate", phase: currentPhase()) }

    @discardableResult
    func beginFiniteWork(application: UIApplication, label: String, durationMilliseconds: UInt32) -> UInt64 {
        let workID = journalQueue.sync { () -> UInt64 in
            let id = nextWorkID
            nextWorkID += 1
            workCancellation[id] = false
            return id
        }
        var task = UIBackgroundTaskIdentifier.invalid
        task = application.beginBackgroundTask(withName: "wasmc.\(label)") { [weak self] in
            guard let self else { return }
            self.record("finite-work-expired", phase: .background, workID: workID)
            self.finish(workID: workID, application: application, task: task)
        }
        journalQueue.sync { backgroundTasks[workID] = task }
        record(
            "finite-work-began",
            phase: .background,
            workID: workID,
            backgroundTimeRemaining: Self.boundedBackgroundTimeRemaining(application)
        )

        workQueue.async { [weak self] in
            guard let self else { return }
            let tickMilliseconds: UInt32 = durationMilliseconds >= 8_000 ? 1_000 : 100
            let ticks = max(1, durationMilliseconds / tickMilliseconds)
            let started = DispatchTime.now().uptimeNanoseconds
            for _ in 0..<ticks {
                let elapsedMilliseconds = UInt32(min(
                    UInt64(UInt32.max),
                    (DispatchTime.now().uptimeNanoseconds - started) / 1_000_000
                ))
                if elapsedMilliseconds >= durationMilliseconds { break }
                let remainingMilliseconds = durationMilliseconds - elapsedMilliseconds
                usleep(min(tickMilliseconds, remainingMilliseconds) * 1_000)
                let cancelled = self.journalQueue.sync { self.workCancellation[workID] ?? true }
                if cancelled {
                    self.record("finite-work-cancelled", phase: .background, workID: workID)
                    self.finish(workID: workID, application: application, task: task)
                    return
                }
                self.record(
                    "finite-work-tick",
                    phase: .background,
                    workID: workID,
                    backgroundTimeRemaining: Self.boundedBackgroundTimeRemaining(application)
                )
            }
            self.record(
                "finite-work-completed",
                phase: .background,
                workID: workID,
                backgroundTimeRemaining: Self.boundedBackgroundTimeRemaining(application)
            )
            self.finish(workID: workID, application: application, task: task)
        }
        return workID
    }

    func cancel(workID: UInt64) {
        journalQueue.sync { workCancellation[workID] = true }
    }

    func events() -> [[String: Any]] {
        journalQueue.sync { Self.readEvents(from: journalURL) }
    }

    func report() -> [String: Any] {
        let retained = events()
        let launches = Set(retained.compactMap { $0["launch_id"] as? String })
        let names = retained.compactMap { $0["name"] as? String }
        let backgroundIndex = names.lastIndex(of: "did-enter-background")
        let foregroundIndex = names.lastIndex(of: "will-enter-foreground")
        let workBeganIndex = names.lastIndex(of: "finite-work-began")
        let workCompletedIndex = names.lastIndex(of: "finite-work-completed")
        let backgroundCycle = backgroundIndex != nil && foregroundIndex != nil && backgroundIndex! < foregroundIndex!
        let workCompleted = workBeganIndex != nil && workCompletedIndex != nil && workBeganIndex! < workCompletedIndex!
        let backgroundWindow: ArraySlice<[String: Any]>
        if let backgroundIndex, let foregroundIndex, backgroundIndex < foregroundIndex {
            backgroundWindow = retained[backgroundIndex...foregroundIndex]
        } else {
            backgroundWindow = []
        }
        let backgroundTicks = backgroundWindow.filter { ($0["name"] as? String) == "finite-work-tick" }.count
        let completedBeforeForeground = backgroundWindow.contains {
            ($0["name"] as? String) == "finite-work-completed"
        }
        let workEvents = backgroundWindow.filter {
            ["finite-work-began", "finite-work-tick", "finite-work-completed"]
                .contains($0["name"] as? String ?? "")
        }
        let remainingSamples = workEvents.compactMap {
            ($0["background_time_remaining_ms"] as? NSNumber)?.uint64Value
        }
        let beganMonotonic = workEvents.first(where: { ($0["name"] as? String) == "finite-work-began" })
            .flatMap { ($0["monotonic_ns"] as? NSNumber)?.uint64Value }
        let completedMonotonic = workEvents.last(where: { ($0["name"] as? String) == "finite-work-completed" })
            .flatMap { ($0["monotonic_ns"] as? NSNumber)?.uint64Value }
        let elapsedMilliseconds = beganMonotonic.flatMap { began in
            completedMonotonic.map { completed in (completed - began) / 1_000_000 }
        } ?? 0
        return [
            "schema": "wasmc.ios-app-lifecycle-qualification/v1",
            "accepted": backgroundCycle && workCompleted && completedBeforeForeground && backgroundTicks > 0,
            "launch_id": launchID,
            "launch_count": launches.count,
            "event_count": retained.count,
            "background_cycle_observed": backgroundCycle,
            "finite_work_began": workBeganIndex != nil,
            "finite_work_completed": workCompleted,
            "finite_work_completed_before_foreground": completedBeforeForeground,
            "finite_work_background_ticks": backgroundTicks,
            "finite_work_requested_ms": finiteWorkDurationMilliseconds,
            "finite_work_elapsed_ms": elapsedMilliseconds,
            "background_time_remaining_sample_count": remainingSamples.count,
            "background_time_remaining_available": !remainingSamples.isEmpty,
            "background_time_remaining_first_ms": remainingSamples.first ?? 0,
            "background_time_remaining_last_ms": remainingSamples.last ?? 0,
            "cold_relaunch_journal_recovered": launches.count >= 2,
            "simulator_suspension_qualified": false,
            "background_task_expiration_qualified": names.contains("finite-work-expired"),
            "bgtaskscheduler_delivery_qualified": false,
            "background_urlsession_delivery_qualified": false,
            "physical_device": false,
            "events": retained,
            "admitted": false,
            "released": false,
        ]
    }

    private func finish(
        workID: UInt64,
        application: UIApplication,
        task: UIBackgroundTaskIdentifier
    ) {
        let shouldEnd = journalQueue.sync { () -> Bool in
            workCancellation.removeValue(forKey: workID)
            return backgroundTasks.removeValue(forKey: workID) != nil
        }
        if shouldEnd && task != .invalid {
            application.endBackgroundTask(task)
        }
    }

    private func record(
        _ name: String,
        phase: UIApplication.State,
        workID: UInt64? = nil,
        backgroundTimeRemaining: TimeInterval? = nil
    ) {
        journalQueue.sync {
            sequence += 1
            var event: [String: Any] = [
                "sequence": sequence,
                "launch_id": launchID,
                "name": name,
                "phase": Self.phaseName(phase),
                "monotonic_ns": DispatchTime.now().uptimeNanoseconds,
                "wall_time_ms": UInt64(Date().timeIntervalSince1970 * 1_000),
                "protected_data_available": UIApplication.shared.isProtectedDataAvailable,
            ]
            if let workID { event["work_id"] = workID }
            if let backgroundTimeRemaining {
                event["background_time_remaining_ms"] = UInt64(backgroundTimeRemaining * 1_000)
            }
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
            NotificationCenter.default.post(name: Self.journalDidChange, object: self)
        }
    }

    private func currentPhase() -> UIApplication.State { UIApplication.shared.applicationState }

    private static func boundedBackgroundTimeRemaining(_ application: UIApplication) -> TimeInterval? {
        let value = application.backgroundTimeRemaining
        return value.isFinite && value >= 0 && value < 1_000_000 ? value : nil
    }

    private static func phaseName(_ phase: UIApplication.State) -> String {
        switch phase {
        case .active: return "active"
        case .background: return "background"
        case .inactive: return "inactive"
        @unknown default: return "unknown"
        }
    }

    private static func readEvents(from url: URL) -> [[String: Any]] {
        guard let text = try? String(contentsOf: url, encoding: .utf8) else { return [] }
        return text.split(separator: "\n").compactMap { line in
            guard let data = String(line).data(using: .utf8),
                  let value = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else { return nil }
            return value
        }
    }
}
