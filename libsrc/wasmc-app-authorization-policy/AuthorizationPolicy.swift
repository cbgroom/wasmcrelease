public enum WAsmCAuthorizationState: String {
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

public enum WAsmCAuthorizationPlan: String {
    case noRequest = "no-request"
    case request = "request"
    case waitForInFlightRequest = "wait-for-in-flight-request"
    case openSettings = "open-settings"
    case failClosed = "fail-closed"
}

public enum WAsmCAuthorizationPolicy {
    public static func plan(
        state: WAsmCAuthorizationState,
        requestInFlight: Bool
    ) -> WAsmCAuthorizationPlan {
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
