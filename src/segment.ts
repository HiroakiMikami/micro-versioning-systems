import { ConstrainedData, Interval } from "./common"

import { Delta } from "./diff"

/** The segment status */
enum Status { Enabled, Disabled }
/** The segment operations */
enum Operation { Enable, Disable }

/** 
 * A chunk of the source code
 *
 * @see http://repository.cmu.edu/cgi/viewcontent.cgi?article=1307&context=hcii
 */
class Segment extends ConstrainedData {
    /**
     * @param offset The offset of the left-hand side of this segment
     * @param text The text contained in this segment
     * @param status The status of this segment
     */
    constructor(public readonly offset: number, public readonly text: string, public readonly status: Status) {
        super(() => {
            if (offset < 0) {
                return `the offset is negative (${offset})`
            }
            if (text.length === 0) {
                return `the text is empty`
            }
            return null
        })
    }

    /**
     * Changes the status of this segment
     *
     * @param operation specify whether this segment is to be enabled or to be disabled
     * @returns The textual delta and the updated segment (null if the operation has no effect)
     */
    public apply(operation: Operation): [Delta, Segment] | null {
        const newStatus = (operation == Operation.Disable) ? Status.Disabled : Status.Enabled
        if (newStatus == this.status) return null

        const s = new Segment(this.offset, this.text, newStatus)
        if (operation == Operation.Enable) {
            const d = new Delta(this.offset, "", this.text)
            return [d, s]
        } else {
            const d = new Delta(this.offset, this.text, "")
            return [d, s]
        }
    }

    /**
     * Split this segment into some segments
     * 
     * @param offsets
     * @returns the list of the splitted segments
     */
    public split(offsets: number[]): Segment[] {
        let _offsets = Array.from(offsets)
        _offsets = _offsets.filter(x => x > this.offset)
        _offsets = _offsets.filter(x => x < this.offset + this.text.length)
        _offsets = _offsets.filter((x, i, self) => self.indexOf(x) === i) // unique
        _offsets = _offsets.sort()
        let index = this.offset
        let retval = []

        const mkSegment = (begin: number, end: number | null) => {
            const s = begin - this.offset
            const text = (end == null)
                ? this.text.slice(s)
                : this.text.slice(s, end - this.offset)
            return new Segment(begin, text, this.status)
        }

        for (const offset of _offsets) {
            retval.push(mkSegment(index, offset))
            index = offset
        }
        retval.push(mkSegment(index, null))
        return retval
    }

    /**
     * Move this segment to the different position
     * 
     * @param direction
     * @returns The updated segment
     */
    public move(direction: number): Segment {
        return new Segment(this.offset + direction, this.text, this.status)
    }

    /**
     * @returns The interval that modified by this segment
     */
    public interval(): Interval {
        if (this.status == Status.Enabled) {
            return new Interval(this.offset, this.text.length)
        } else {
            return new Interval(this.offset, 0)
        }
    }
}

export { Status, Operation, Segment }
