import XCTest

final class NetworkPathUITests: XCTestCase {
    func testSystemPathSnapshot() {
        let app = XCUIApplication()
        app.launch()
        XCTAssertTrue(app.staticTexts["network-path-title"].waitForExistence(timeout: 10))
        XCTAssertTrue(app.staticTexts["network-path-complete"].waitForExistence(timeout: 10))
    }
}
