import XCTest

final class BackgroundTransferUITests: XCTestCase {
    func testDownloadCompletesWhileAppIsBackgrounded() {
        let app = XCUIApplication()
        app.launchArguments = ["--wasmc-reset-transfer"]
        app.launch()
        XCTAssertTrue(app.staticTexts["background-transfer-title"].waitForExistence(timeout: 10))
        let start = app.buttons["background-transfer-start"]
        XCTAssertTrue(start.waitForExistence(timeout: 5))
        start.tap()
        XCUIDevice.shared.press(.home)
        sleep(10)
        app.activate()
        XCTAssertTrue(app.staticTexts["background-transfer-complete"].waitForExistence(timeout: 15))
    }

    func testTerminationDoesNotProveAutomaticRelaunch() {
        let app = XCUIApplication()
        app.launch()
        XCTAssertTrue(app.staticTexts["background-transfer-title"].waitForExistence(timeout: 10))
        app.buttons["background-transfer-start"].tap()
        XCUIDevice.shared.press(.home)
        sleep(1)
        app.terminate()
        XCTAssertFalse(app.wait(for: .runningBackground, timeout: 12))
        app.activate()
        XCTAssertTrue(app.staticTexts["background-transfer-complete"].waitForExistence(timeout: 15))
    }

    func testCancellationSuppressesResultPublication() {
        let app = XCUIApplication()
        app.launch()
        XCTAssertTrue(app.staticTexts["background-transfer-title"].waitForExistence(timeout: 10))
        app.buttons["background-transfer-start"].tap()
        sleep(1)
        app.buttons["background-transfer-cancel"].tap()
        XCTAssertTrue(app.staticTexts["background-transfer-cancel-complete"].waitForExistence(timeout: 10))
    }
}
