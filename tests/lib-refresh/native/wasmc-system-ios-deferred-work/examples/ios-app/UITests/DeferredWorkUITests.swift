import XCTest

final class DeferredWorkUITests: XCTestCase {
    func testSimulatorReportsSubmissionUnavailable() {
        let app = XCUIApplication()
        app.launch()
        XCTAssertTrue(app.staticTexts["deferred-work-title"].waitForExistence(timeout: 10))
        app.buttons["deferred-work-schedule"].tap()
        XCTAssertTrue(app.staticTexts["deferred-work-simulator-unavailable"].waitForExistence(timeout: 10))
        app.buttons["deferred-work-cancel"].tap()
        XCTAssertTrue(app.staticTexts["deferred-work-simulator-unavailable"].waitForExistence(timeout: 10))
    }
}
