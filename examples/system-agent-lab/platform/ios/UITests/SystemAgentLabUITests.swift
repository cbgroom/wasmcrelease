import XCTest

final class SystemAgentLabUITests: XCTestCase {
    func testExactLibsComposeWithoutHostGrowth() {
        let app = XCUIApplication()
        app.launch()
        XCTAssertTrue(app.staticTexts["system-agent-lab-title"].waitForExistence(timeout: 10))
        XCTAssertTrue(app.staticTexts["system-agent-lab-complete"].waitForExistence(timeout: 20))
    }
}

