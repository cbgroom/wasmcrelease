import XCTest

final class SurfaceControlUITests: XCTestCase {
    func testHumanHandoffWhileOtherSurfacesContinue() {
        let app = XCUIApplication()
        app.launch()

        XCTAssertTrue(app.staticTexts["surface-demo-title"].waitForExistence(timeout: 10))
        let expand = app.buttons["surface-task-3-expand"]
        XCTAssertTrue(expand.waitForExistence(timeout: 10))
        sleep(1)
        expand.tap()

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
