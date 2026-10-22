import Foundation
import Network

final class NetworkPathProvider {
    static let didChange = Notification.Name("wasmc.network-path.did-change")
    private let monitor = NWPathMonitor()
    private let monitorQueue = DispatchQueue(label: "io.wasmc.network-path.monitor")
    private let stateQueue = DispatchQueue(label: "io.wasmc.network-path.state")
    private var state: [String: Any] = [
        "status": "unknown",
        "interfaces": [],
        "expensive": false,
        "constrained": false,
        "supports_ipv4": false,
        "supports_ipv6": false,
        "supports_dns": false,
        "generation": 0,
    ]

    func descriptorProbe(_ input: Data) throws -> Data {
        precondition(input.isEmpty)
        return try JSONSerialization.data(withJSONObject: [
            "api": "wasmc:system-network-path@0.0.1",
            "provider": "wasmc:system-ios-network-path@0.0.1-dev.1",
            "transport": "NWPathMonitor",
            "path_mutation": false,
        ], options: [.sortedKeys])
    }

    func start() {
        monitor.pathUpdateHandler = { [weak self] path in
            guard let self else { return }
            var interfaces: [String] = []
            if path.usesInterfaceType(.wifi) { interfaces.append("wifi") }
            if path.usesInterfaceType(.cellular) { interfaces.append("cellular") }
            if path.usesInterfaceType(.wiredEthernet) { interfaces.append("wired-ethernet") }
            if path.usesInterfaceType(.loopback) { interfaces.append("loopback") }
            if path.usesInterfaceType(.other) { interfaces.append("other") }
            self.stateQueue.sync {
                self.state["status"] = Self.statusName(path.status)
                self.state["interfaces"] = interfaces
                self.state["expensive"] = path.isExpensive
                self.state["constrained"] = path.isConstrained
                self.state["supports_ipv4"] = path.supportsIPv4
                self.state["supports_ipv6"] = path.supportsIPv6
                self.state["supports_dns"] = path.supportsDNS
                self.state["generation"] = (self.state["generation"] as? Int ?? 0) + 1
            }
            DispatchQueue.main.async {
                NotificationCenter.default.post(name: Self.didChange, object: self)
            }
        }
        monitor.start(queue: monitorQueue)
    }

    func report() -> [String: Any] {
        var snapshot = stateQueue.sync { state }
        snapshot["schema"] = "wasmc.ios-network-path-qualification/v1"
        snapshot["accepted"] = (snapshot["status"] as? String) == "satisfied"
            && (snapshot["generation"] as? Int ?? 0) >= 1
        snapshot["transition_qualified"] = false
        snapshot["server_reachability_qualified"] = false
        snapshot["physical_device"] = false
        snapshot["admitted"] = false
        snapshot["released"] = false
        return snapshot
    }

    private static func statusName(_ status: NWPath.Status) -> String {
        switch status {
        case .satisfied: return "satisfied"
        case .unsatisfied: return "unsatisfied"
        case .requiresConnection: return "requires-connection"
        @unknown default: return "unknown"
        }
    }

    deinit { monitor.cancel() }
}
