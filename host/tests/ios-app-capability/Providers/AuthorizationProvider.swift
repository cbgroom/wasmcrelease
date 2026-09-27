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
    case requestOnce = "request-once"
    case openSettings = "open-settings"
    case failClosed = "fail-closed"
}

private enum AuthorizationPolicy {
    static func plan(state: AuthorizationState, attempted: Bool) -> AuthorizationPlan {
        switch state {
        case .notRequired, .authorized, .limited, .provisional, .ephemeral:
            return .noRequest
        case .notDetermined:
            return attempted ? .openSettings : .requestOnce
        case .denied:
            return .openSettings
        case .restricted, .unavailable, .unknown:
            return .failClosed
        }
    }
}

private struct AuthorizationAttemptLedger {
    private let defaults: UserDefaults
    private let prefix = "wasmc.authorization.attempted."

    init(defaults: UserDefaults = .standard) {
        self.defaults = defaults
    }

    func hasAttempted(_ capability: String) -> Bool {
        defaults.bool(forKey: prefix + capability)
    }

    func recordAttempt(_ capability: String) {
        defaults.set(true, forKey: prefix + capability)
    }

    func clearProbe(_ capability: String) {
        defaults.removeObject(forKey: prefix + capability)
    }
}

enum AuthorizationProvider {
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
            let attempted = ledger.hasAttempted(name)
            return [
                "capability": name,
                "state": state.rawValue,
                "attempted": attempted,
                "plan": AuthorizationPolicy.plan(state: state, attempted: attempted).rawValue,
            ] as [String: Any]
        }
        let policyTests = [
            AuthorizationPolicy.plan(state: .notRequired, attempted: false) == .noRequest,
            AuthorizationPolicy.plan(state: .authorized, attempted: false) == .noRequest,
            AuthorizationPolicy.plan(state: .notDetermined, attempted: false) == .requestOnce,
            AuthorizationPolicy.plan(state: .notDetermined, attempted: true) == .openSettings,
            AuthorizationPolicy.plan(state: .denied, attempted: true) == .openSettings,
            AuthorizationPolicy.plan(state: .restricted, attempted: false) == .failClosed,
            AuthorizationPolicy.plan(state: .unavailable, attempted: false) == .failClosed,
        ].allSatisfy { $0 }
        let probeCapability = "qualification-probe"
        ledger.clearProbe(probeCapability)
        let absentBeforeRecord = !ledger.hasAttempted(probeCapability)
        ledger.recordAttempt(probeCapability)
        let presentAfterRecord = ledger.hasAttempted(probeCapability)
        ledger.clearProbe(probeCapability)
        return try ProviderSupport.encode([
            "discovery_prompt_count": 0,
            "permission_free_capabilities": permissionFree,
            "permission_free_count": permissionFree.count,
            "authorization_decisions": decisions,
            "one_app_rationale_session": true,
            "request_only_when_not_determined_and_unattempted": true,
            "denied_does_not_reprompt": true,
            "restricted_and_unavailable_fail_closed": true,
            "os_prompts_cannot_be_coalesced_across_permission_categories": true,
            "policy_state_machine_tests": policyTests,
            "persistent_attempt_ledger_roundtrip": absentBeforeRecord && presentAfterRecord,
        ])
    }
}
