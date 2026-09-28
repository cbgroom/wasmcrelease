import UIKit

@main
final class AppDelegate: UIResponder, UIApplicationDelegate {
    var window: UIWindow?
    private let provider = WebSocketProvider()

    func application(
        _ application: UIApplication,
        didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
    ) -> Bool {
        let registration = ProviderRegistration(
            identity: "wasmc:system-ios-websocket@0.0.1-dev.5",
            witPackage: "wasmc:system-websocket@0.0.1",
            maxInputBytes: 0,
            maxOutputBytes: 2048,
            invoke: provider.descriptorProbe
        )
        guard let evidence = try? FixedHost.run([registration]) else { return false }
        let controller = WebSocketViewController(provider: provider, providerEvidence: evidence)
        let window = UIWindow(frame: UIScreen.main.bounds)
        window.rootViewController = controller
        window.makeKeyAndVisible()
        self.window = window
        return true
    }

    func applicationDidEnterBackground(_ application: UIApplication) {
        provider.didEnterBackground(application)
    }

    func applicationWillEnterForeground(_ application: UIApplication) {
        provider.willEnterForeground(application)
    }
}
