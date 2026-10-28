import Foundation
import UIKit
import UserNotifications

final class LocalNotificationProvider: NSObject, UNUserNotificationCenterDelegate {
    static let didChange = Notification.Name("wasmc.local-notification.did-change")
    static let identifier = "wasmc.local-notification.fixture.v1"
    static let title = "WAsmC local notification"
    static let body = "Simulator background delivery fixture"
    static let payloadValue = "payload-v1"

    private let center = UNUserNotificationCenter.current()
    private let queue = DispatchQueue(label: "io.wasmc.local-notification.state")
    private var state: [String: Any] = [
        "authorization": "not-determined",
        "authorization_request_attempts": 0,
        "scheduled": false,
        "schedule_error": "",
        "background_unix_ms": 0,
        "foreground_return_unix_ms": 0,
        "delivered": false,
        "exact_identifier": false,
        "exact_title": false,
        "exact_body": false,
        "exact_payload": false,
        "delivery_unix_ms": 0,
        "delivery_between_background_boundaries": false,
    ]

    override init() {
        super.init()
        center.delegate = self
    }

    func descriptorProbe(_ input: Data) throws -> Data {
        precondition(input.isEmpty)
        return try JSONSerialization.data(withJSONObject: [
            "api": "wasmc:system-local-notification@0.0.1",
            "provider": "wasmc:system-ios-local-notification@0.0.1-dev.1",
            "transport": "UNUserNotificationCenter",
            "remote_push": false,
        ], options: [.sortedKeys])
    }

    func reset() {
        center.removeAllPendingNotificationRequests()
        center.removeAllDeliveredNotifications()
        queue.sync {
            state = [
                "authorization": "not-determined",
                "authorization_request_attempts": 0,
                "scheduled": false,
                "schedule_error": "",
                "background_unix_ms": 0,
                "foreground_return_unix_ms": 0,
                "delivered": false,
                "exact_identifier": false,
                "exact_title": false,
                "exact_body": false,
                "exact_payload": false,
                "delivery_unix_ms": 0,
                "delivery_between_background_boundaries": false,
            ]
        }
        refreshAuthorization()
    }

    func requestAuthorizationAndSchedule() {
        queue.sync {
            state["authorization_request_attempts"] = (state["authorization_request_attempts"] as? Int ?? 0) + 1
        }
        center.requestAuthorization(options: [.alert, .sound, .badge]) { [weak self] granted, error in
            guard let self else { return }
            self.refreshAuthorization {
                if granted && error == nil {
                    self.scheduleFixture()
                } else {
                    self.queue.sync { self.state["schedule_error"] = error.map(String.init(describing:)) ?? "authorization-denied" }
                    self.publish()
                }
            }
        }
    }

    func markDidEnterBackground() {
        queue.sync { state["background_unix_ms"] = Self.nowMilliseconds() }
        publish()
    }

    func markWillEnterForeground() {
        queue.sync { state["foreground_return_unix_ms"] = Self.nowMilliseconds() }
        refreshDelivered()
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.75) { [weak self] in
            self?.refreshDelivered()
        }
        DispatchQueue.main.asyncAfter(deadline: .now() + 2.0) { [weak self] in
            self?.refreshDelivered()
        }
    }

    func report() -> [String: Any] {
        var snapshot = queue.sync { state }
        let accepted = (snapshot["authorization"] as? String) == "authorized"
            && (snapshot["scheduled"] as? Bool) == true
            && (snapshot["delivered"] as? Bool) == true
            && (snapshot["exact_identifier"] as? Bool) == true
            && (snapshot["exact_title"] as? Bool) == true
            && (snapshot["exact_body"] as? Bool) == true
            && (snapshot["exact_payload"] as? Bool) == true
            && (snapshot["delivery_between_background_boundaries"] as? Bool) == true
        snapshot["schema"] = "wasmc.ios-local-notification-qualification/v1"
        snapshot["accepted"] = accepted
        snapshot["notification_identifier"] = Self.identifier
        snapshot["remote_push_qualified"] = false
        snapshot["silent_push_qualified"] = false
        snapshot["notification_extension_qualified"] = false
        snapshot["physical_device"] = false
        snapshot["admitted"] = false
        snapshot["released"] = false
        return snapshot
    }

    private func refreshAuthorization(completion: (() -> Void)? = nil) {
        center.getNotificationSettings { [weak self] settings in
            guard let self else { return }
            self.queue.sync { self.state["authorization"] = Self.authorizationName(settings.authorizationStatus) }
            self.publish()
            completion?()
        }
    }

    private func scheduleFixture() {
        let content = UNMutableNotificationContent()
        content.title = Self.title
        content.body = Self.body
        content.userInfo = ["wasmc": Self.payloadValue]
        let trigger = UNTimeIntervalNotificationTrigger(timeInterval: 5, repeats: false)
        let request = UNNotificationRequest(identifier: Self.identifier, content: content, trigger: trigger)
        center.add(request) { [weak self] error in
            guard let self else { return }
            self.queue.sync {
                self.state["scheduled"] = error == nil
                self.state["schedule_error"] = error.map(String.init(describing:)) ?? ""
            }
            self.publish()
        }
    }

    private func refreshDelivered() {
        center.getDeliveredNotifications { [weak self] notifications in
            guard let self else { return }
            let item = notifications.first { $0.request.identifier == Self.identifier }
            if let item { self.recordDelivered(item) }
        }
    }

    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        didReceive response: UNNotificationResponse,
        withCompletionHandler completionHandler: @escaping () -> Void
    ) {
        recordDelivered(response.notification)
        completionHandler()
    }

    private func recordDelivered(_ item: UNNotification) {
        let delivery = Int(item.date.timeIntervalSince1970 * 1_000)
        queue.sync {
            let background = state["background_unix_ms"] as? Int ?? 0
            let foreground = state["foreground_return_unix_ms"] as? Int ?? Self.nowMilliseconds()
            state["delivered"] = true
            state["exact_identifier"] = item.request.identifier == Self.identifier
            state["exact_title"] = item.request.content.title == Self.title
            state["exact_body"] = item.request.content.body == Self.body
            state["exact_payload"] = item.request.content.userInfo["wasmc"] as? String == Self.payloadValue
            state["delivery_unix_ms"] = delivery
            state["delivery_between_background_boundaries"] = background > 0 && delivery >= background && foreground >= delivery
        }
        publish()
    }

    private func publish() {
        DispatchQueue.main.async { NotificationCenter.default.post(name: Self.didChange, object: self) }
    }

    private static func nowMilliseconds() -> Int { Int(Date().timeIntervalSince1970 * 1_000) }

    private static func authorizationName(_ status: UNAuthorizationStatus) -> String {
        switch status {
        case .notDetermined: return "not-determined"
        case .denied: return "denied"
        case .authorized: return "authorized"
        case .provisional: return "provisional"
        case .ephemeral: return "ephemeral"
        @unknown default: return "unknown"
        }
    }
}
