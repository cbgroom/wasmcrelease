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
}
