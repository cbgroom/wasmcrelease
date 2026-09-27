import Foundation

enum EmbeddedProfile {
    static let registrations: [ProviderRegistration] = [
        .init(
            identity: "wasmc:system-ios-app-storage@0.0.1-dev.1",
            witPackage: "wasmc:system-app-storage@0.0.1",
            maxInputBytes: 0,
            maxOutputBytes: 16_384,
            invoke: StorageProvider.invoke
        ),
        .init(
            identity: "wasmc:system-ios-app-state@0.0.1-dev.1",
            witPackage: "wasmc:system-app-state@0.0.1",
            maxInputBytes: 0,
            maxOutputBytes: 16_384,
            invoke: StateProvider.invoke
        ),
        .init(
            identity: "wasmc:system-ios-app-network@0.0.1-dev.1",
            witPackage: "wasmc:system-app-network@0.0.1",
            maxInputBytes: 0,
            maxOutputBytes: 16_384,
            invoke: NetworkProvider.invoke
        ),
        .init(
            identity: "wasmc:system-ios-app-ui@0.0.1-dev.1",
            witPackage: "wasmc:system-ui@0.0.1",
            maxInputBytes: 0,
            maxOutputBytes: 65_536,
            invoke: UIProvider.invoke
        ),
        .init(
            identity: "wasmc:system-ios-app-display@0.0.1-dev.1",
            witPackage: "wasmc:system-display@0.0.1",
            maxInputBytes: 0,
            maxOutputBytes: 65_536,
            invoke: DisplayProvider.invoke
        ),
        .init(
            identity: "wasmc:system-ios-app-metal@0.0.1-dev.1",
            witPackage: "wasmc:system-app-accelerator@0.0.1",
            maxInputBytes: 0,
            maxOutputBytes: 16_384,
            invoke: MetalProvider.invoke
        ),
        .init(
            identity: "wasmc:system-ios-app-database@0.0.1-dev.1",
            witPackage: "wasmc:system-app-database@0.0.1",
            maxInputBytes: 0,
            maxOutputBytes: 16_384,
            invoke: DatabaseProvider.invoke
        ),
        .init(
            identity: "wasmc:system-ios-app-crypto@0.0.1-dev.1",
            witPackage: "wasmc:system-app-crypto@0.0.1",
            maxInputBytes: 0,
            maxOutputBytes: 16_384,
            invoke: CryptoProvider.invoke
        ),
        .init(
            identity: "wasmc:system-ios-app-audio@0.0.1-dev.1",
            witPackage: "wasmc:system-app-audio@0.0.1",
            maxInputBytes: 0,
            maxOutputBytes: 16_384,
            invoke: AudioProvider.invoke
        ),
        .init(
            identity: "wasmc:system-ios-app-web@0.0.1-dev.1",
            witPackage: "wasmc:system-app-web@0.0.1",
            maxInputBytes: 0,
            maxOutputBytes: 16_384,
            invoke: WebProvider.invoke
        ),
        .init(
            identity: "wasmc:system-ios-app-device-observation@0.0.1-dev.1",
            witPackage: "wasmc:system-app-device-observation@0.0.1",
            maxInputBytes: 0,
            maxOutputBytes: 16_384,
            invoke: DeviceObservationProvider.invoke
        ),
        .init(
            identity: "wasmc:system-ios-app-authorization@0.0.1-dev.1",
            witPackage: "wasmc:system-app-authorization@0.0.1",
            maxInputBytes: 0,
            maxOutputBytes: 32_768,
            invoke: AuthorizationProvider.invoke
        ),
    ]
}
