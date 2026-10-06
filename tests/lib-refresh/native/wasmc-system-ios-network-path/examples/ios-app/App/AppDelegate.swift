import UIKit

@main
final class AppDelegate: UIResponder, UIApplicationDelegate {
    var window: UIWindow?
    private let provider = NetworkPathProvider()

    func application(
        _ application: UIApplication,
        didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
    ) -> Bool {
        let registration = ProviderRegistration(
            identity: "wasmc:system-ios-network-path@0.0.1-dev.1",
            witPackage: "wasmc:system-network-path@0.0.1",
            maxInputBytes: 0,
            maxOutputBytes: 2048,
            invoke: provider.descriptorProbe
        )
        guard let evidence = try? FixedHost.run([registration]) else { return false }
        let controller = NetworkPathViewController(provider: provider, providerEvidence: evidence)
        let window = UIWindow(frame: UIScreen.main.bounds)
        window.rootViewController = controller
        window.makeKeyAndVisible()
        self.window = window
        provider.start()
        return true
    }
}
