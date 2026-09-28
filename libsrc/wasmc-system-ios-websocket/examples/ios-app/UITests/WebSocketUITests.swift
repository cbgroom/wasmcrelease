import XCTest

final class WebSocketUITests: XCTestCase {
    func testForegroundAndFiniteBackgroundDuplex() {
        let app = XCUIApplication()
        app.launch()
        XCTAssertTrue(app.staticTexts["websocket-title"].waitForExistence(timeout: 10))
        app.buttons["websocket-connect"].tap()
        XCTAssertTrue(app.staticTexts["websocket-foreground-ready"].waitForExistence(timeout: 10))
        XCUIDevice.shared.press(.home)
        sleep(5)
        app.activate()
        XCTAssertTrue(app.staticTexts["websocket-complete"].waitForExistence(timeout: 10))
    }
}
