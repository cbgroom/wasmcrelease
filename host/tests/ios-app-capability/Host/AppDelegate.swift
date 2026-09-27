import UIKit

@main
final class AppDelegate: UIResponder, UIApplicationDelegate {
    var window: UIWindow?
    private var qualificationRan = false
    private var contactsRequestStarted = false
    private var contactsRequestCompleted = false

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

        if ProcessInfo.processInfo.arguments.contains("--request-contacts") {
            if contactsRequestCompleted {
                runQualificationWhenStable()
                return
            }
            guard !contactsRequestStarted else { return }
            contactsRequestStarted = true
            AuthorizationProvider.requestContactsIfNeeded { [weak self] in
                guard let self else { return }
                self.contactsRequestCompleted = true
                if UIApplication.shared.applicationState == .active {
                    self.runQualificationWhenStable()
                }
            }
            return
        }

        qualificationRan = true
        runQualification()
    }

    private func runQualificationWhenStable() {
        guard !qualificationRan, UIApplication.shared.applicationState == .active else { return }
        qualificationRan = true
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.2) { [weak self] in
            self?.runQualification()
        }
    }

    private func runQualification() {
        do {
            let authorizationFlow = ProcessInfo.processInfo.arguments.contains("--request-contacts")
            let registrations = authorizationFlow
                ? EmbeddedProfile.authorizationFlowRegistrations
                : EmbeddedProfile.registrations
            let providerResults = try FixedHost.run(registrations)
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
            publishCompletionMarker("qualification:accepted")
        } catch {
            try? writeReport([
                "schema": "wasmc.ios-app-capability-qualification/v1",
                "accepted": false,
                "error": String(describing: error),
            ])
            publishCompletionMarker("qualification:rejected")
        }
    }

    private func publishCompletionMarker(_ text: String) {
        guard let controller = window?.rootViewController else { return }
        let marker = UILabel()
        marker.text = text
        marker.accessibilityIdentifier = "wasmc-qualification-complete"
        marker.translatesAutoresizingMaskIntoConstraints = false
        controller.view.addSubview(marker)
        NSLayoutConstraint.activate([
            marker.centerXAnchor.constraint(equalTo: controller.view.centerXAnchor),
            marker.bottomAnchor.constraint(equalTo: controller.view.safeAreaLayoutGuide.bottomAnchor, constant: -16),
        ])
    }

    private func writeReport(_ report: [String: Any]) throws {
        let data = try JSONSerialization.data(withJSONObject: report, options: [.prettyPrinted, .sortedKeys])
        let documents = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask).first!
        try data.write(to: documents.appendingPathComponent("wasmc-ios-app-capability.json"), options: .atomic)
    }
}
