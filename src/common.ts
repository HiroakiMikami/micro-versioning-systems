import { AssertionError } from "assert";

/** A flag to specify whether the system validates data structures or not */
enum ExecutionMode {
    Release = "release",
    Debug = "debug"
}

/** A data structure with constrains */
abstract class ConstrainedData {
    constructor() {
        if (ConstrainedData.mode == ExecutionMode.Debug) {
            const ret = this.validate()
            if (ret !== null) {
                throw new AssertionError({ message: `${this}: ${ret}`})
            }
        }
    }
    /**
     * @returns null if this object is valid, otherwise returns an error message
     */
    public abstract validate(): string | null

    /** The current execution mode */
    static mode: ExecutionMode = ExecutionMode.Release
}

export { ExecutionMode, ConstrainedData }
