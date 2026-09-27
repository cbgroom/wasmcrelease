import UIKit

@main
final class AppDelegate: UIResponder, UIApplicationDelegate {
    var window: UIWindow?
    private var qualificationRan = false

    func application(
        _ application: UIApplication,
        didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
    ) -> Bool {
        let window = UIWindow(frame: UIScreen.main.bounds)
        let controller = UIViewController()
        controller.view.backgroundColor = .systemBackground
        window.rootViewController = controller
        window.makeKeyAndVisible()
        self.window = window

        return true
    }

    func applicationDidBecomeActive(_ application: UIApplication) {
        guard !qualificationRan else { return }
        qualificationRan = true

        do {
            let providerResults = try FixedHost.run(EmbeddedProfile.registrations)
            let report: [String: Any] = [
                "schema": "wasmc.ios-app-capability-qualification/v1",
                "accepted": true,
                "host_domain_apis": 0,
                "host_negative_controls": FixedHost.negativeControls(),
                "provider_count": providerResults.count,
                "providers": providerResults,
                "target": [
                    "os": "ios",
                    "architecture": "aarch64",
                    "environment": "simulator",
                    "embedding": "native",
                ],
            ]
            try writeReport(report)
        } catch {
            try? writeReport([
                "schema": "wasmc.ios-app-capability-qualification/v1",
                "accepted": false,
                "error": String(describing: error),
            ])
        }
    }

    private func writeReport(_ report: [String: Any]) throws {
        let data = try JSONSerialization.data(withJSONObject: report, options: [.prettyPrinted, .sortedKeys])
        let documents = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask).first!
        try data.write(to: documents.appendingPathComponent("wasmc-ios-app-capability.json"), options: .atomic)
    }
}
