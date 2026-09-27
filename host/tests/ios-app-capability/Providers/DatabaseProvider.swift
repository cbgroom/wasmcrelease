import Foundation
import SQLite3

enum DatabaseProvider {
    static func invoke(_ input: Data) throws -> Data {
        let manager = FileManager.default
        let support = manager.urls(for: .applicationSupportDirectory, in: .userDomainMask).first!
        try manager.createDirectory(at: support, withIntermediateDirectories: true)
        let path = support.appendingPathComponent("wasmc-database-probe.sqlite").path
        var database: OpaquePointer?
        guard sqlite3_open_v2(path, &database, SQLITE_OPEN_CREATE | SQLITE_OPEN_READWRITE, nil) == SQLITE_OK,
              let database else {
            throw NSError(domain: "wasmc.database", code: 1)
        }
        defer { sqlite3_close(database) }
        let statements = [
            "PRAGMA journal_mode=WAL",
            "CREATE TABLE IF NOT EXISTS probe (id INTEGER PRIMARY KEY, value TEXT NOT NULL)",
            "BEGIN IMMEDIATE",
            "DELETE FROM probe",
            "INSERT INTO probe(id, value) VALUES (1, 'wasmc-sqlite')",
            "COMMIT",
        ]
        for statement in statements {
            guard sqlite3_exec(database, statement, nil, nil, nil) == SQLITE_OK else {
                throw NSError(domain: "wasmc.database", code: 2)
            }
        }
        var prepared: OpaquePointer?
        guard sqlite3_prepare_v2(database, "SELECT value FROM probe WHERE id = ?", -1, &prepared, nil) == SQLITE_OK,
              let prepared else {
            throw NSError(domain: "wasmc.database", code: 3)
        }
        defer { sqlite3_finalize(prepared) }
        sqlite3_bind_int(prepared, 1, 1)
        guard sqlite3_step(prepared) == SQLITE_ROW,
              let text = sqlite3_column_text(prepared, 0) else {
            throw NSError(domain: "wasmc.database", code: 4)
        }
        let observed = String(cString: text)
        return try ProviderSupport.encode([
            "sqlite_available": true,
            "transaction_committed": true,
            "prepared_statement": true,
            "wal_mode": true,
            "roundtrip": observed == "wasmc-sqlite",
            "path_confined_to_container": path.contains("/Containers/Data/Application/"),
        ])
    }
}
