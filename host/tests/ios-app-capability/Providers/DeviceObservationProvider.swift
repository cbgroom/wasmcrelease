import AVFoundation
import CoreLocation
import CoreMotion
import Foundation
import UIKit
import UserNotifications

enum DeviceObservationProvider {
    private static func authorizationName(_ status: AVAuthorizationStatus) -> String {
        switch status {
        case .authorized: return "authorized"
        case .denied: return "denied"
        case .restricted: return "restricted"
        case .notDetermined: return "not-determined"
        @unknown default: return "unknown"
        }
    }

    private static func locationAuthorizationName(_ status: CLAuthorizationStatus) -> String {
        switch status {
        case .authorizedAlways: return "authorized-always"
        case .authorizedWhenInUse: return "authorized-when-in-use"
        case .denied: return "denied"
        case .restricted: return "restricted"
        case .notDetermined: return "not-determined"
        @unknown default: return "unknown"
        }
    }

    private static func notificationAuthorizationName(_ status: UNAuthorizationStatus) -> String {
        switch status {
        case .authorized: return "authorized"
        case .denied: return "denied"
        case .notDetermined: return "not-determined"
        case .provisional: return "provisional"
        case .ephemeral: return "ephemeral"
        @unknown default: return "unknown"
        }
    }

    private static func backgroundRefreshName(_ status: UIBackgroundRefreshStatus) -> String {
        switch status {
        case .available: return "available"
        case .denied: return "denied"
        case .restricted: return "restricted"
        @unknown default: return "unknown"
        }
    }

    static func invoke(_ input: Data) throws -> Data {
        let motion = CMMotionManager()
        let notificationSemaphore = DispatchSemaphore(value: 0)
        var notificationAuthorization = "unavailable"
        UNUserNotificationCenter.current().getNotificationSettings { settings in
            notificationAuthorization = notificationAuthorizationName(settings.authorizationStatus)
            notificationSemaphore.signal()
        }
        let notificationSettingsObserved = notificationSemaphore.wait(timeout: .now() + 2) == .success
        return try ProviderSupport.encode([
            "camera_available": AVCaptureDevice.default(for: .video) != nil,
            "camera_authorization": authorizationName(AVCaptureDevice.authorizationStatus(for: .video)),
            "microphone_available": AVCaptureDevice.default(for: .audio) != nil,
            "microphone_authorization": authorizationName(AVCaptureDevice.authorizationStatus(for: .audio)),
            "accelerometer_available": motion.isAccelerometerAvailable,
            "gyroscope_available": motion.isGyroAvailable,
            "magnetometer_available": motion.isMagnetometerAvailable,
            "device_motion_available": motion.isDeviceMotionAvailable,
            "location_services_enabled": CLLocationManager.locationServicesEnabled(),
            "location_authorization": locationAuthorizationName(CLLocationManager().authorizationStatus),
            "notification_settings_observed": notificationSettingsObserved,
            "notification_authorization": notificationAuthorization,
            "background_refresh_status": backgroundRefreshName(UIApplication.shared.backgroundRefreshStatus),
            "permission_requested": false,
            "simulator_observation_only": true,
        ])
    }
}
