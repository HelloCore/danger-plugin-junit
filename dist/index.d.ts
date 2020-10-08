export declare function message(message: string): void;
export declare function warn(message: string): void;
export declare function fail(message: string): void;
export declare function markdown(message: string): void;
interface JUnitReportOptions {
    /**
     * The path to the generated junit files.
     */
    pathToReport?: string;
    /**
     * Whether the test summary message will be reported using danger's `message()`. Defaults to true.
     */
    showMessageTestSummary?: boolean;
    /**
     * Message to show at the top of the test results table. Defaults to "Tests"
     */
    name?: string;
}
/**
 * Add your Junit XML test failures to Danger
 */
export default function junit(options: JUnitReportOptions): Promise<void>;
export {};
