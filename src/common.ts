import { AssertionError } from "assert";

/** The segment status */
enum Status { Enabled, Disabled }
/** The segment operations */
enum Operation { Enable, Disable }

/** A flag to specify whether the system validates data structures or not */
enum ExecutionMode {
    Release = "release",
    Debug = "debug"
}

/** A data structure with constrains */
abstract class ConstrainedData {
    /**
     * @param validate A validation function that returns null if this object is valid, otherwise returns an error message
     */
    constructor(validate: () => string | null) {
        if (ConstrainedData.mode == ExecutionMode.Debug) {
            const ret = validate()
            if (ret !== null) {
                throw new AssertionError({ message: `${this}: ${ret}`})
            }
        }
    }

    /** The current execution mode */
    static mode: ExecutionMode = ExecutionMode.Release
}

/** An interval [this.begin:this.end) */
class Interval extends ConstrainedData {
    public readonly end: number

    /**
     * @param begin
     * @param length The length of this interval
     */
    constructor (public readonly begin: number, public readonly length: number) {
        super(() => {
            if (length < 0) {
                return `the length is negative (${length})`
            }
            return null
        })
        this.end = this.begin + length
    }

    /**
     * @returns the intersection of this and rhs (null if there is no overlap)
     */
    public intersect(rhs: Interval): Interval | null {
        if (this.begin > rhs.begin) {
            return rhs.intersect(this)
        }

        /* Pre-condition: this.begin <= rhs.begin */
        if (this.begin != rhs.begin && this.end <= rhs.begin) {
            return null
        }
        const begin = Math.max(this.begin, rhs.begin)
        const end = Math.min(this.end, rhs.end)

        return new Interval(begin, Math.max(0, end - begin))
    }

    public toString(): string {
        return `[${this.begin}:${this.end})`
    }
}

export { ExecutionMode, ConstrainedData, Interval, Status, Operation }
