import Contacts
import Foundation

enum ContactsProvider {
    private static func authorizationName(_ status: CNAuthorizationStatus) -> String {
        switch status {
        case .authorized: return "authorized"
        case .limited: return "limited"
        case .denied: return "denied"
        case .restricted: return "restricted"
        case .notDetermined: return "not-determined"
        @unknown default: return "unknown"
        }
    }

    static func invoke(_ input: Data) throws -> Data {
        let status = CNContactStore.authorizationStatus(for: .contacts)
        guard status == .authorized else {
            return try ProviderSupport.encode([
                "authorization": authorizationName(status),
                "use_attempted": false,
                "create_fetch_delete_roundtrip": false,
                "cleanup_confirmed": true,
            ])
        }

        let store = CNContactStore()
        let contact = CNMutableContact()
        contact.givenName = "WAsmC"
        contact.familyName = "Qualification-\(UUID().uuidString)"
        let create = CNSaveRequest()
        create.add(contact, toContainerWithIdentifier: nil)
        try store.execute(create)

        var fetched = false
        var cleanupConfirmed = false
        do {
            let keys = [CNContactGivenNameKey, CNContactFamilyNameKey] as [CNKeyDescriptor]
            let stored = try store.unifiedContact(withIdentifier: contact.identifier, keysToFetch: keys)
            fetched = stored.givenName == contact.givenName && stored.familyName == contact.familyName
            let remove = CNSaveRequest()
            remove.delete(stored.mutableCopy() as! CNMutableContact)
            try store.execute(remove)
            do {
                _ = try store.unifiedContact(withIdentifier: contact.identifier, keysToFetch: keys)
            } catch CNError.recordDoesNotExist {
                cleanupConfirmed = true
            }
        } catch {
            let remove = CNSaveRequest()
            remove.delete(contact)
            try? store.execute(remove)
            throw error
        }

        return try ProviderSupport.encode([
            "authorization": authorizationName(status),
            "use_attempted": true,
            "created": true,
            "fetched": fetched,
            "deleted": cleanupConfirmed,
            "create_fetch_delete_roundtrip": fetched && cleanupConfirmed,
            "cleanup_confirmed": cleanupConfirmed,
        ])
    }
}
