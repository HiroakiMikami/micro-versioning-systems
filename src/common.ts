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

/** An interval [this.begin:this.end) */
class Interval extends ConstrainedData {
    public readonly end: number

    /**
     * @param begin
     * @param length The length of this interval
     */
    constructor (public readonly begin: number, public readonly length: number) {
        super()
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
    public validate(): string | null {
        if (this.length < 0) {
            return `the length is negative (${this.length})`
        }
        return null
    }
}

export { ExecutionMode, ConstrainedData, Interval }
