import XCTest

final class WebSocketUITests: XCTestCase {
    func testPinnedWSSServiceRestartReconnectAndOutboxDelivery() {
        let app = XCUIApplication()
        app.launchArguments = ["--wasmc-wss", "--wasmc-wss-recovery"]
        app.launch()
        XCTAssertTrue(app.staticTexts["websocket-title"].waitForExistence(timeout: 10))
        app.buttons["websocket-connect"].tap()
        XCTAssertTrue(app.staticTexts["websocket-recovery-complete"].waitForExistence(timeout: 20))
    }

    func testPinnedWSSReconnectStopsAfterBoundedAttempts() {
        let app = XCUIApplication()
        app.launchArguments = ["--wasmc-wss", "--wasmc-wss-recovery"]
        app.launch()
        XCTAssertTrue(app.staticTexts["websocket-title"].waitForExistence(timeout: 10))
        app.buttons["websocket-connect"].tap()
        XCTAssertTrue(app.staticTexts["websocket-reconnect-exhausted"].waitForExistence(timeout: 20))
    }

    func testPinnedWSSRejectsDifferentExpectedCertificate() {
        let app = XCUIApplication()
        app.launchArguments = ["--wasmc-wss", "--wasmc-wss-wrong-pin"]
        app.launch()
        XCTAssertTrue(app.staticTexts["websocket-title"].waitForExistence(timeout: 10))
        app.buttons["websocket-connect"].tap()
        XCTAssertTrue(app.staticTexts["websocket-pin-rejected"].waitForExistence(timeout: 10))
    }

    func testPinnedWSSForegroundAndFiniteBackgroundDuplex() {
        let app = XCUIApplication()
        app.launchArguments = ["--wasmc-wss"]
        app.launch()
        XCTAssertTrue(app.staticTexts["websocket-title"].waitForExistence(timeout: 10))
        app.buttons["websocket-connect"].tap()
        XCTAssertTrue(app.staticTexts["websocket-foreground-ready"].waitForExistence(timeout: 10))
        XCUIDevice.shared.press(.home)
        sleep(5)
        app.activate()
        XCTAssertTrue(app.staticTexts["websocket-complete"].waitForExistence(timeout: 10))
    }

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
