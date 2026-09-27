import CryptoKit
import Foundation

struct ProviderRegistration {
    let identity: String
    let witPackage: String
    let maxInputBytes: Int
    let maxOutputBytes: Int
    let invoke: (Data) throws -> Data
}

enum FixedHostError: Error {
    case duplicateIdentity
    case invalidDescriptor
    case inputLimit
    case outputLimit
}

enum FixedHost {
    static func run(_ registrations: [ProviderRegistration]) throws -> [[String: Any]] {
        guard Set(registrations.map(\.identity)).count == registrations.count else {
            throw FixedHostError.duplicateIdentity
        }
        return try registrations.map { registration in
            guard !registration.identity.isEmpty,
                  !registration.witPackage.isEmpty,
                  registration.maxInputBytes >= 0,
                  registration.maxOutputBytes > 0 else {
                throw FixedHostError.invalidDescriptor
            }
            let input = Data()
            guard input.count <= registration.maxInputBytes else { throw FixedHostError.inputLimit }
            let output = try registration.invoke(input)
            guard output.count <= registration.maxOutputBytes else { throw FixedHostError.outputLimit }
            let digest = SHA256.hash(data: output).map { String(format: "%02x", $0) }.joined()
            return [
                "identity": registration.identity,
                "wit_package": registration.witPackage,
                "input_bytes": input.count,
                "output_bytes": output.count,
                "output_sha256": digest,
                "result": try JSONSerialization.jsonObject(with: output),
            ]
        }
    }

    static func negativeControls() -> [String: Bool] {
        let inert = ProviderRegistration(
            identity: "probe:provider@0.0.0",
            witPackage: "probe:contract@0.0.0",
            maxInputBytes: 0,
            maxOutputBytes: 1,
            invoke: { _ in Data() }
        )
        let duplicateRejected: Bool
        do {
            _ = try run([inert, inert])
            duplicateRejected = false
        } catch FixedHostError.duplicateIdentity {
            duplicateRejected = true
        } catch {
            duplicateRejected = false
        }
        let outputLimitRejected: Bool
        do {
            _ = try run([ProviderRegistration(
                identity: inert.identity,
                witPackage: inert.witPackage,
                maxInputBytes: 0,
                maxOutputBytes: 1,
                invoke: { _ in Data([0, 1]) }
            )])
            outputLimitRejected = false
        } catch FixedHostError.outputLimit {
            outputLimitRejected = true
        } catch {
            outputLimitRejected = false
        }
        let invalidDescriptorRejected: Bool
        do {
            _ = try run([ProviderRegistration(
                identity: "",
                witPackage: inert.witPackage,
                maxInputBytes: 0,
                maxOutputBytes: 1,
                invoke: inert.invoke
            )])
            invalidDescriptorRejected = false
        } catch FixedHostError.invalidDescriptor {
            invalidDescriptorRejected = true
        } catch {
            invalidDescriptorRejected = false
        }
        return [
            "duplicate_identity_rejected": duplicateRejected,
            "invalid_descriptor_rejected": invalidDescriptorRejected,
            "output_limit_rejected": outputLimitRejected,
        ]
    }
}
