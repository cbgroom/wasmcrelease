import XCTest

final class SurfaceControlUITests: XCTestCase {
    func testHumanHandoffWhileOtherSurfacesContinue() {
        let app = XCUIApplication()
        app.launch()

        XCTAssertTrue(app.staticTexts["surface-demo-title"].waitForExistence(timeout: 10))
        let collapse = app.buttons["surface-shelf-collapse"]
        XCTAssertTrue(collapse.waitForExistence(timeout: 5))
        collapse.tap()
        let dock = app.buttons["surface-shelf-dock"]
        XCTAssertTrue(dock.waitForExistence(timeout: 5))
        sleep(1)
        dock.tap()

        let expand = app.buttons["surface-task-3-expand"]
        XCTAssertTrue(expand.waitForExistence(timeout: 10))
        sleep(1)
        expand.tap()

        let confirm = app.buttons["surface-task-3-confirm-takeover"]
        XCTAssertTrue(confirm.waitForExistence(timeout: 5))
        XCTAssertFalse(app.textFields["surface-task-3-human-input"].exists)
        confirm.tap()

        let input = app.textFields["surface-task-3-human-input"]
        XCTAssertTrue(input.waitForExistence(timeout: 5))
        input.tap()
        input.typeText("human-approved")

        let complete = app.buttons["surface-task-3-complete"]
        XCTAssertTrue(complete.waitForExistence(timeout: 5))
        complete.tap()

        XCTAssertTrue(app.staticTexts["surface-demo-complete"].waitForExistence(timeout: 10))
        XCTAssertTrue(app.buttons["surface-task-3-expand"].waitForExistence(timeout: 5))
    }
}
