import UIKit

@main
final class AppDelegate: UIResponder, UIApplicationDelegate {
    var window: UIWindow?
    private let networkProvider = NetworkPathProvider()
    private let webProvider = WebViewSurfaceProvider()

    func application(
        _ application: UIApplication,
        didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
    ) -> Bool {
        let registrations = [
            ProviderRegistration(
                identity: "wasmc:system-ios-app-surface-control@0.0.3-dev.1",
                witPackage: "wasmc:system-app-surface-control@0.0.3",
                maxInputBytes: 0,
                maxOutputBytes: 2048,
                invoke: WebViewSurfaceProvider.descriptorProbe
            ),
            ProviderRegistration(
                identity: "wasmc:system-ios-network-path@0.0.1-dev.1",
                witPackage: "wasmc:system-network-path@0.0.1",
                maxInputBytes: 0,
                maxOutputBytes: 2048,
                invoke: networkProvider.descriptorProbe
            ),
        ]
        guard let evidence = try? FixedHost.run(registrations) else { return false }
        let controller = AgentLabViewController(
            webProvider: webProvider,
            networkProvider: networkProvider,
            providerEvidence: evidence
        )
        let window = UIWindow(frame: UIScreen.main.bounds)
        window.rootViewController = controller
        window.makeKeyAndVisible()
        self.window = window
        networkProvider.start()
        return true
    }
}

