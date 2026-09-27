import CryptoKit
import Foundation

enum CryptoProvider {
    static func invoke(_ input: Data) throws -> Data {
        let plaintext = Data("wasmc-crypto-roundtrip".utf8)
        let key = SymmetricKey(size: .bits256)
        let sealed = try AES.GCM.seal(plaintext, using: key)
        let opened = try AES.GCM.open(sealed, using: key)
        let signingKey = P256.Signing.PrivateKey()
        let signature = try signingKey.signature(for: plaintext)
        let verified = signingKey.publicKey.isValidSignature(signature, for: plaintext)
        let digest = SHA256.hash(data: plaintext)
        return try ProviderSupport.encode([
            "aes_gcm_roundtrip": opened == plaintext,
            "p256_sign_verify": verified,
            "sha256_bytes": Array(digest).count,
            "ciphertext_bytes": sealed.ciphertext.count,
            "nonce_bytes": sealed.nonce.withUnsafeBytes { $0.count },
        ])
    }
}
