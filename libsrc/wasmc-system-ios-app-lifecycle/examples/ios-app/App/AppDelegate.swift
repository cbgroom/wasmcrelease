import UIKit

@main
final class AppDelegate: UIResponder, UIApplicationDelegate {
    var window: UIWindow?
    private var provider: AppLifecycleProvider!
    private weak var controller: LifecycleViewController?

    func application(
        _ application: UIApplication,
        didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
    ) -> Bool {
        let arguments = ProcessInfo.processInfo.arguments
        provider = AppLifecycleProvider(
            resetJournal: arguments.contains("--wasmc-reset-lifecycle-journal"),
            finiteWorkDurationMilliseconds: arguments.contains("--wasmc-finite-window-probe") ? 8_000 : 600
        )
        provider.didFinishLaunching()
        let registration = ProviderRegistration(
            identity: "wasmc:system-ios-app-lifecycle@0.0.1-dev.1",
            witPackage: "wasmc:system-app-lifecycle@0.0.1",
            maxInputBytes: 0,
            maxOutputBytes: 2048,
            invoke: provider.descriptorProbe
        )
        guard let providerEvidence = try? FixedHost.run([registration]) else { return false }
        let controller = LifecycleViewController(provider: provider, providerEvidence: providerEvidence)
        let window = UIWindow(frame: UIScreen.main.bounds)
        window.rootViewController = controller
        window.makeKeyAndVisible()
        self.window = window
        self.controller = controller
        return true
    }

    func applicationWillResignActive(_ application: UIApplication) {
        provider.willResignActive()
    }

    func applicationDidEnterBackground(_ application: UIApplication) {
        provider.didEnterBackground(application)
    }

    func applicationWillEnterForeground(_ application: UIApplication) {
        provider.willEnterForeground()
    }

    func applicationDidBecomeActive(_ application: UIApplication) {
        provider.didBecomeActive()
        controller?.refresh()
    }

    func applicationWillTerminate(_ application: UIApplication) {
        provider.willTerminate()
    }
}
