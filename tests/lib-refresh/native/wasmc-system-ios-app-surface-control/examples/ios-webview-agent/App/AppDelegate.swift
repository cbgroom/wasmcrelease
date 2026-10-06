import UIKit

@main
final class AppDelegate: UIResponder, UIApplicationDelegate {
    var window: UIWindow?

    func application(
        _ application: UIApplication,
        didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
    ) -> Bool {
        let registration = ProviderRegistration(
            identity: "wasmc:system-ios-app-surface-control@0.0.3-dev.1",
            witPackage: "wasmc:system-app-surface-control@0.0.3",
            maxInputBytes: 0,
            maxOutputBytes: 2048,
            invoke: WebViewSurfaceProvider.descriptorProbe
        )
        guard let evidence = try? FixedHost.run([registration]) else { return false }
        let controller = WebViewAgentViewController(providerEvidence: evidence)
        let window = UIWindow(frame: UIScreen.main.bounds)
        window.rootViewController = controller
        window.makeKeyAndVisible()
        self.window = window
        return true
    }
}
