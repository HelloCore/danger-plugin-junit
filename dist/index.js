"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs = require("fs-extra");
const glob = require("glob");
const util_1 = require("util");
const xmldom_1 = require("xmldom");
/**
 * Add your Junit XML test failures to Danger
 */
function junit(options) {
    return __awaiter(this, void 0, void 0, function* () {
        const currentPath = options.pathToReport !== undefined ? options.pathToReport : "./build/reports/**/TESTS*.xml";
        const shouldShowMessageTestSummary = options.showMessageTestSummary !== undefined ? options.showMessageTestSummary : true;
        const name = options.name ? options.name : "Tests";
        // Use glob to find xml reports!
        const matches = yield util_1.promisify(glob)(currentPath);
        if (matches.length === 0) {
            warn(`:mag: Can't find junit reports at \`${currentPath}\`, skipping generating JUnit Report.`);
            return;
        }
        // Gather all the suites up
        const allSuites = yield Promise.all(matches.map((m) => gatherSuites(m)));
        const suites = allSuites.reduce((acc, val) => acc.concat(val), []);
        // Give a summary message
        if (shouldShowMessageTestSummary) {
            reportSummary(suites);
        }
        // Give details on failed tests
        const failuresAndErrors = gatherFailedTestcases(suites);
        if (failuresAndErrors.length !== 0) {
            reportFailures(failuresAndErrors, name);
        }
    });
}
exports.default = junit;
function gatherErrorDetail(failure) {
    let detail = "";
    if (failure.hasAttribute("type") && failure.getAttribute("type") !== "") {
        detail += `${failure.getAttribute("type")}: `;
    }
    if (failure.hasAttribute("message")) {
        detail += failure.getAttribute("message");
    }
    if (failure.hasAttribute("stack")) {
        detail += "\n" + failure.getAttribute("stack");
    }
    if (failure.hasChildNodes()) {
        // CDATA stack trace
        detail += "\n" + failure.firstChild.nodeValue.trim();
        // .replace(/</g, "&lt;")
        // .replace(/>/g, "&gt;")
    }
    return detail.split("\\n").join("\n");
}
function reportFailures(failuresAndErrors, name) {
    fail(`${name} have failed, see below for more information.`);
    let testResultsTable = `\n\n#### ❗️\[danger-plugin-junit\] Error Messages ️❗️\n\n---\n\n`;
    const keys = Array.from(failuresAndErrors[0].attributes).map((attr) => attr.nodeName);
    const attributes = keys.map((key) => {
        return key.substr(0, 1).toUpperCase() + key.substr(1).toLowerCase();
    });
    // TODO: Force order? Classname, name, time
    attributes.push("Error");
    // TODO Include stderr/stdout too?
    // Create the headers
    // testResultsTable += `|${attributes.join("|")}|\n`
    // Map out the keys to the tests
    failuresAndErrors.forEach((test) => {
        const rowValues = keys.map((key) => test.getAttribute(key));
        // push error/failure message too
        const errors = test.getElementsByTagName("error");
        if (errors.length !== 0) {
            rowValues.push(gatherErrorDetail(errors.item(0)));
        }
        else {
            const failures = test.getElementsByTagName("failure");
            if (failures.length !== 0) {
                rowValues.push(gatherErrorDetail(failures.item(0)));
            }
            else {
                rowValues.push(""); // This shouldn't ever happen
            }
        }
        // testResultsTable += `|${rowValues.join("|")}|\n`
        rowValues.map((value, index) => {
            if (attributes[index] == "Error") {
                testResultsTable += `\n\n#### Message\n\n\`\`\`\n${value}\n\`\`\`\n\n`;
            }
            else if (attributes[index] == "Classname") {
                testResultsTable += `\n\n❌ Fail in \`${value.substr(19).split('.').join('/')}.dart\``;
            }
            else if (attributes[index] == "Time") {
                const time = Number.parseFloat(value);
                testResultsTable += `\n\n> ${attributes[index]}: **${time * 1000} ms**`;
            }
            else {
                testResultsTable += `\n\n> ${attributes[index]}: **${value}**`;
            }
            testResultsTable += `\n\n---\n\n`;
        });
    });
    markdown(testResultsTable);
}
function reportSummary(suites) {
    const results = {
        count: 0,
        failures: 0,
        skipped: 0,
    };
    // for each test suite, look at:
    // tests="19" failures="1" skipped="3" timestamp="" time="6.487">
    // FIXME: Sometimes these numbers look "suspect" and may be reporting incorrect numbers versus the actual contents...
    suites.forEach((s) => {
        results.count += s.hasAttribute("tests") ? parseInt(s.getAttribute("tests"), 10) : 0;
        results.failures += s.hasAttribute("failures") ? parseInt(s.getAttribute("failures"), 10) : 0;
        results.failures += s.hasAttribute("errors") ? parseInt(s.getAttribute("errors"), 10) : 0;
        results.skipped += s.hasAttribute("skipped") ? parseInt(s.getAttribute("skipped"), 10) : gatherSkipped(s);
    });
    if (results.failures !== 0) {
        message(`:x: ${results.failures} tests have failed
There are ${results.failures} tests failing and ${results.skipped} skipped out of ${results.count} total tests.`);
    }
    else {
        let msg = `:white_check_mark: All tests are passing
Nice one! All ${results.count - results.skipped} tests are passing.`;
        if (results.skipped !== 0) {
            msg += `\n(There are ${results.skipped} skipped tests not included in that total)`;
        }
        message(msg);
    }
}
function gatherSuites(reportPath) {
    return __awaiter(this, void 0, void 0, function* () {
        const exists = yield fs.pathExists(reportPath);
        if (!exists) {
            return [];
        }
        const contents = yield fs.readFile(reportPath, "utf8");
        const doc = new xmldom_1.DOMParser().parseFromString(contents, "text/xml");
        const suiteRoot = doc.documentElement.firstChild.tagName === "testsuites" ? doc.documentElement.firstChild : doc.documentElement;
        return suiteRoot.tagName === "testsuite" ? [suiteRoot] : Array.from(suiteRoot.getElementsByTagName("testsuite"));
    });
}
// Report test failures
function gatherFailedTestcases(suites) {
    // We need to get the 'testcase' elements that have an 'error' or 'failure' child node
    const failedSuites = suites.filter((suite) => {
        const hasFailures = suite.hasAttribute("failures") && parseInt(suite.getAttribute("failures"), 10) !== 0;
        const hasErrors = suite.hasAttribute("errors") && parseInt(suite.getAttribute("errors"), 10) !== 0;
        return hasFailures || hasErrors;
    });
    // Gather all the testcase nodes from each failed suite properly.
    let failedSuitesAllTests = [];
    failedSuites.forEach((suite) => {
        failedSuitesAllTests = failedSuitesAllTests.concat(Array.from(suite.getElementsByTagName("testcase")));
    });
    return failedSuitesAllTests.filter((test) => {
        return (test.hasChildNodes() &&
            (test.getElementsByTagName("failure").length > 0 || test.getElementsByTagName("error").length > 0));
    });
}
function gatherSkipped(suite) {
    const testcases = Array.from(suite.getElementsByTagName("testcase"));
    return testcases.filter((test) => {
        return test.hasChildNodes() && test.getElementsByTagName("skipped").length > 0;
    }).length;
}
