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
            invoke: SurfaceControlProvider.descriptorProbe
        )
        guard let providerEvidence = try? FixedHost.run([registration]) else { return false }

        let controller = SurfaceDemoViewController()
        controller.onQualificationComplete = { [weak controller] report in
            var retained = report
            retained["provider_evidence"] = providerEvidence
            Self.writeReport(retained)
            let marker = UILabel()
            marker.text = "surface-demo:accepted"
            marker.textColor = .white
            marker.accessibilityIdentifier = "surface-demo-complete"
            marker.frame = CGRect(x: 20, y: 8, width: 240, height: 30)
            controller?.view.addSubview(marker)
        }

        let window = UIWindow(frame: UIScreen.main.bounds)
        window.rootViewController = controller
        window.makeKeyAndVisible()
        self.window = window
        return true
    }

    private static func writeReport(_ report: [String: Any]) {
        guard let data = try? JSONSerialization.data(
            withJSONObject: report,
            options: [.prettyPrinted, .sortedKeys]
        ) else { return }
        let documents = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask).first!
        try? data.write(to: documents.appendingPathComponent("wasmc-ios-surface-control.json"), options: .atomic)
    }
}
