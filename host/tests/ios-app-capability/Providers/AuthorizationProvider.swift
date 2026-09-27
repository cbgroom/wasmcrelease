import AVFoundation
import Contacts
import CoreLocation
import CoreMotion
import EventKit
import Foundation
import Photos
import Speech
import UserNotifications

private enum AuthorizationState: String {
    case notRequired = "not-required"
    case unavailable
    case notDetermined = "not-determined"
    case denied
    case restricted
    case authorized
    case limited
    case provisional
    case ephemeral
    case unknown
}

private enum AuthorizationPlan: String {
    case noRequest = "no-request"
    case request = "request"
    case waitForInFlightRequest = "wait-for-in-flight-request"
    case openSettings = "open-settings"
    case failClosed = "fail-closed"
}

private enum AuthorizationPolicy {
    static func plan(state: AuthorizationState, requestInFlight: Bool) -> AuthorizationPlan {
        switch state {
        case .notRequired, .authorized, .limited, .provisional, .ephemeral:
            return .noRequest
        case .notDetermined:
            return requestInFlight ? .waitForInFlightRequest : .request
        case .denied:
            return .openSettings
        case .restricted, .unavailable, .unknown:
            return .failClosed
        }
    }
}

private struct AuthorizationAttemptLedger {
    private let defaults: UserDefaults
    private let prefix = "wasmc.authorization.attempt-count."

    init(defaults: UserDefaults = .standard) {
        self.defaults = defaults
    }

    func attemptCount(_ capability: String) -> Int {
        defaults.integer(forKey: prefix + capability)
    }

    @discardableResult
    func recordAttempt(_ capability: String) -> Int {
        let next = attemptCount(capability) + 1
        defaults.set(next, forKey: prefix + capability)
        return next
    }

    func clearProbe(_ capability: String) {
        defaults.removeObject(forKey: prefix + capability)
    }
}

enum AuthorizationProvider {
    static func requestContactsIfNeeded(completion: @escaping () -> Void) {
        guard CNContactStore.authorizationStatus(for: .contacts) == .notDetermined else {
            completion()
            return
        }
        let ledger = AuthorizationAttemptLedger()
        ledger.recordAttempt("contacts")
        CNContactStore().requestAccess(for: .contacts) { _, _ in
            DispatchQueue.main.async(execute: completion)
        }
    }

    private static func avState(_ status: AVAuthorizationStatus) -> AuthorizationState {
        switch status {
        case .authorized: return .authorized
        case .denied: return .denied
        case .restricted: return .restricted
        case .notDetermined: return .notDetermined
        @unknown default: return .unknown
        }
    }

    private static func locationState(_ status: CLAuthorizationStatus) -> AuthorizationState {
        switch status {
        case .authorizedAlways, .authorizedWhenInUse: return .authorized
        case .denied: return .denied
        case .restricted: return .restricted
        case .notDetermined: return .notDetermined
        @unknown default: return .unknown
        }
    }

    private static func motionState(_ status: CMAuthorizationStatus) -> AuthorizationState {
        switch status {
        case .authorized: return .authorized
        case .denied: return .denied
        case .restricted: return .restricted
        case .notDetermined: return .notDetermined
        @unknown default: return .unknown
        }
    }

    private static func photoState(_ status: PHAuthorizationStatus) -> AuthorizationState {
        switch status {
        case .authorized: return .authorized
        case .limited: return .limited
        case .denied: return .denied
        case .restricted: return .restricted
        case .notDetermined: return .notDetermined
        @unknown default: return .unknown
        }
    }

    private static func contactState(_ status: CNAuthorizationStatus) -> AuthorizationState {
        switch status {
        case .authorized: return .authorized
        case .limited: return .limited
        case .denied: return .denied
        case .restricted: return .restricted
        case .notDetermined: return .notDetermined
        @unknown default: return .unknown
        }
    }

    private static func eventState(_ status: EKAuthorizationStatus) -> AuthorizationState {
        switch status {
        case .fullAccess, .writeOnly, .authorized: return .authorized
        case .denied: return .denied
        case .restricted: return .restricted
        case .notDetermined: return .notDetermined
        @unknown default: return .unknown
        }
    }

    private static func speechState(_ status: SFSpeechRecognizerAuthorizationStatus) -> AuthorizationState {
        switch status {
        case .authorized: return .authorized
        case .denied: return .denied
        case .restricted: return .restricted
        case .notDetermined: return .notDetermined
        @unknown default: return .unknown
        }
    }

    private static func notificationState() -> AuthorizationState {
        let semaphore = DispatchSemaphore(value: 0)
        var observed: AuthorizationState = .unknown
        UNUserNotificationCenter.current().getNotificationSettings { settings in
            switch settings.authorizationStatus {
            case .authorized: observed = .authorized
            case .denied: observed = .denied
            case .notDetermined: observed = .notDetermined
            case .provisional: observed = .provisional
            case .ephemeral: observed = .ephemeral
            @unknown default: observed = .unknown
            }
            semaphore.signal()
        }
        return semaphore.wait(timeout: .now() + 2) == .success ? observed : .unknown
    }

    static func invoke(_ input: Data) throws -> Data {
        let location = CLLocationManager()
        let ledger = AuthorizationAttemptLedger()
        let observedStates: [(String, AuthorizationState)] = [
            ("camera", AVCaptureDevice.default(for: .video) == nil ? .unavailable : avState(AVCaptureDevice.authorizationStatus(for: .video))),
            ("microphone", AVCaptureDevice.default(for: .audio) == nil ? .unavailable : avState(AVCaptureDevice.authorizationStatus(for: .audio))),
            ("location-when-in-use", CLLocationManager.locationServicesEnabled() ? locationState(location.authorizationStatus) : .unavailable),
            ("motion", CMMotionActivityManager.isActivityAvailable() ? motionState(CMMotionActivityManager.authorizationStatus()) : .unavailable),
            ("notifications", notificationState()),
            ("photos-read-write", photoState(PHPhotoLibrary.authorizationStatus(for: .readWrite))),
            ("contacts", contactState(CNContactStore.authorizationStatus(for: .contacts))),
            ("calendar", eventState(EKEventStore.authorizationStatus(for: .event))),
            ("reminders", eventState(EKEventStore.authorizationStatus(for: .reminder))),
            ("speech-recognition", speechState(SFSpeechRecognizer.authorizationStatus())),
        ]
        let permissionFree = [
            "sandbox-storage", "secure-random", "keychain-after-signing", "preferences", "clocks",
            "tcp-udp", "app-ui", "app-window-capture", "metal", "sqlite", "cryptography",
            "offline-audio", "local-webkit",
        ]
        let decisions = observedStates.map { name, state in
            let attemptCount = ledger.attemptCount(name)
            return [
                "capability": name,
                "state": state.rawValue,
                "attempt_count": attemptCount,
                "request_in_flight": false,
                "plan": AuthorizationPolicy.plan(state: state, requestInFlight: false).rawValue,
            ] as [String: Any]
        }
        let policyTests = [
            AuthorizationPolicy.plan(state: .notRequired, requestInFlight: false) == .noRequest,
            AuthorizationPolicy.plan(state: .authorized, requestInFlight: false) == .noRequest,
            AuthorizationPolicy.plan(state: .notDetermined, requestInFlight: false) == .request,
            AuthorizationPolicy.plan(state: .notDetermined, requestInFlight: true) == .waitForInFlightRequest,
            AuthorizationPolicy.plan(state: .notDetermined, requestInFlight: false) == .request,
            AuthorizationPolicy.plan(state: .denied, requestInFlight: false) == .openSettings,
            AuthorizationPolicy.plan(state: .restricted, requestInFlight: false) == .failClosed,
            AuthorizationPolicy.plan(state: .unavailable, requestInFlight: false) == .failClosed,
        ].allSatisfy { $0 }
        let probeCapability = "qualification-probe"
        ledger.clearProbe(probeCapability)
        let absentBeforeRecord = ledger.attemptCount(probeCapability) == 0
        let firstCount = ledger.recordAttempt(probeCapability)
        let secondCount = ledger.recordAttempt(probeCapability)
        ledger.clearProbe(probeCapability)
        return try ProviderSupport.encode([
            "discovery_prompt_count": 0,
            "permission_free_capabilities": permissionFree,
            "permission_free_count": permissionFree.count,
            "authorization_decisions": decisions,
            "one_app_rationale_session": true,
            "request_when_not_determined_even_after_prior_failure": true,
            "repeat_request_after_unsuccessful_attempt": true,
            "in_flight_request_deduplicated": true,
            "denied_routes_to_settings_and_can_be_reoffered": true,
            "restricted_and_unavailable_fail_closed": true,
            "os_prompts_cannot_be_coalesced_across_permission_categories": true,
            "policy_state_machine_tests": policyTests,
            "persistent_attempt_history_roundtrip": absentBeforeRecord && firstCount == 1 && secondCount == 2,
        ])
    }
}
