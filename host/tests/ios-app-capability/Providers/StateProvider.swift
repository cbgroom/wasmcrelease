import Foundation
import Security

enum StateProvider {
    private static func statusMessage(_ status: OSStatus) -> String {
        (SecCopyErrorMessageString(status, nil) as String?) ?? "OSStatus \(status)"
    }

    static func invoke(_ input: Data) throws -> Data {
        var random = [UInt8](repeating: 0, count: 32)
        let randomStatus = SecRandomCopyBytes(kSecRandomDefault, random.count, &random)
        let defaults = UserDefaults.standard
        let previous = defaults.integer(forKey: "wasmc-launch-count")
        defaults.set(previous + 1, forKey: "wasmc-launch-count")

        let service = "io.wasmc.app-capability-lab"
        let account = "probe"
        let value = Data("wasmc-keychain".utf8)
        let base: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
        ]
        SecItemDelete(base as CFDictionary)
        var add = base
        add[kSecValueData as String] = value
        let addStatus = SecItemAdd(add as CFDictionary, nil)
        var query = base
        query[kSecReturnData as String] = true
        query[kSecMatchLimit as String] = kSecMatchLimitOne
        var result: CFTypeRef?
        let readStatus = SecItemCopyMatching(query as CFDictionary, &result)
        let keychainRoundtrip = readStatus == errSecSuccess && (result as? Data) == value
        let deleteStatus = SecItemDelete(base as CFDictionary)

        let monotonicStart = DispatchTime.now().uptimeNanoseconds
        let monotonicEnd = DispatchTime.now().uptimeNanoseconds
        return try ProviderSupport.encode([
            "secure_random": randomStatus == errSecSuccess && Set(random).count > 1,
            "secure_random_bytes": random.count,
            "user_defaults_persisted": defaults.integer(forKey: "wasmc-launch-count") == previous + 1,
            "launch_count": previous + 1,
            "keychain_add": addStatus == errSecSuccess,
            "keychain_add_status": addStatus,
            "keychain_add_message": statusMessage(addStatus),
            "keychain_roundtrip": keychainRoundtrip,
            "keychain_read_status": readStatus,
            "keychain_read_message": statusMessage(readStatus),
            "keychain_delete": deleteStatus == errSecSuccess,
            "keychain_delete_status": deleteStatus,
            "keychain_delete_message": statusMessage(deleteStatus),
            "wall_clock_positive": Date().timeIntervalSince1970 > 0,
            "monotonic_clock": monotonicEnd >= monotonicStart,
        ])
    }
}
