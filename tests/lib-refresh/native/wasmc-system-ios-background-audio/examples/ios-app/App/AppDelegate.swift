import UIKit

@main
final class AppDelegate: UIResponder, UIApplicationDelegate {
    var window: UIWindow?
    private let provider = BackgroundAudioProvider()

    func application(
        _ application: UIApplication,
        didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
    ) -> Bool {
        provider.reset()
        let registration = ProviderRegistration(
            identity: "wasmc:system-ios-background-audio@0.0.1-dev.1",
            witPackage: "wasmc:system-background-audio@0.0.1",
            maxInputBytes: 0,
            maxOutputBytes: 2048,
            invoke: provider.descriptorProbe
        )
        guard let evidence = try? FixedHost.run([registration]) else { return false }
        let controller = BackgroundAudioViewController(provider: provider, providerEvidence: evidence)
        let window = UIWindow(frame: UIScreen.main.bounds)
        window.rootViewController = controller
        window.makeKeyAndVisible()
        self.window = window
        return true
    }
}
