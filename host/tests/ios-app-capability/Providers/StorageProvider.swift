import Foundation

enum StorageProvider {
    static func invoke(_ input: Data) throws -> Data {
        let manager = FileManager.default
        let support = manager.urls(for: .applicationSupportDirectory, in: .userDomainMask).first!
        try manager.createDirectory(at: support, withIntermediateDirectories: true)
        let file = support.appendingPathComponent("wasmc-storage-probe.bin")
        let payload = Data("wasmc-ios-app-storage".utf8)
        try payload.write(to: file, options: .atomic)
        let handle = try FileHandle(forWritingTo: file)
        try handle.synchronize()
        try handle.close()
        let observed = try Data(contentsOf: file)
        let attributes = try manager.attributesOfItem(atPath: file.path)
        return try ProviderSupport.encode([
            "sandbox_roundtrip": observed == payload,
            "atomic_replace": true,
            "fsync": true,
            "bytes": observed.count,
            "regular_file": attributes[.type] as? FileAttributeType == .typeRegular,
            "path_confined_to_container": file.path.contains("/Containers/Data/Application/"),
        ])
    }
}
