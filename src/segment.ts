import * as uuidv4 from "uuid/v4"

import { ConstrainedData, Interval } from "./common"
import { Delta, Diff, DeleteNonExistingText } from "./diff"
import { ImmutableDirectedGraph, to_immutable, to_mutable } from "./graph"

/** The segment status */
enum Status { Enabled, Disabled }
/** The segment operations */
enum Operation { Enable, Disable }

/**
 * A result of the operation
 */
class ApplyResult {
    /**
     * @param newHistory The new history
     * @param diff The difference between the previous source code and the text of `newHistory`
     * @param splittedSegments The set of segments that are splitted by the operation
     * @param remove The list of segments that are deleted by the operation
     * @param insert The list of segments that are inserted by the operation
     */
    constructor(
        public readonly newHistory: SegmentHistory,
        public readonly diff: Diff,
        public readonly splittedSegments: ReadonlyMap<string, ReadonlyArray<string>>,
        public readonly remove: ReadonlyArray<string>,
        public readonly insert: ReadonlyArray<string>
    ) {}
}

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

    public toString(): string {
        const text = `${this.text} (offset=${this.offset})`
        if (this.status === Status.Enabled) {
            return text
        } else {
            return `~${text}~`
        }
    }
}

/**
 * A source code history that uses segments
 *
 * @see http://repository.cmu.edu/cgi/viewcontent.cgi?article=1307&context=hcii
 */
class SegmentHistory extends ConstrainedData {
    /**
     *
     * @param segments The set of segments
     * @param closing The graph representing 'closing' relation
     * @param text The current source code
     */
    constructor(
        public readonly segments: ReadonlyMap<string, Segment>,
        public readonly closing: ImmutableDirectedGraph<string, number>,
        public readonly text: string
    ) {
        super(() => {
            /* invalid if the text in the enabled segment is not in the text */
            for (const elem of segments) {
                const segment = elem[1]
                if (segment.status == Status.Disabled) continue
                const t = text.substr(segment.offset, segment.text.length)
                if (t !== segment.text) {
                    return `the text and the text of the enabled segment are different (the text: ${t}, the enabled segment: ${segment})`
                }
            }
            /* invalid if two different enabled segments are overlapped */
            for (const [id1, s1] of segments) {
                if (s1.status == Status.Disabled) continue
                for (const [id2, s2] of segments) {
                    if (id1 === id2) continue
                    if (s2.status === Status.Disabled) continue

                    if (s1.interval().intersect(s2.interval()) !== null) {
                        return `the enabled segments are overlapped (${id1}: ${s1} and ${id2}: ${s2}`
                    }
                }
            }
            /* invalid if the closing contains the enablsed segment */
            for (const id of closing.vertices) {
                if (!segments.has(id) ) {
                    return `the closed segment is not found (${id})`
                }
                if (segments.get(id).status === Status.Enabled) {
                    return `the enabled segment is closed (${id}: ${segments.has(id)})`
                }
            }

            return null
        })
    }
    /**
     * Applies diff to the source code, and updates the history
     *
     * @param diff The diff to be applied
     * @returns The result of applying diff
     */
    public apply_diff(diff: Diff): ApplyResult | DeleteNonExistingText {
        const deltas = Array.from(diff.deltas)
        deltas.reverse()

        let newSegments = new Map(this.segments)
        let newClosing = to_mutable(this.closing)
        let splittedIds = new Map<string, string[]>()
        let remove = []
        let insert = []
        let newText = this.text

        let ids = new Set()
        function mkId() {
            let id = uuidv4()
            while (newSegments.has(id) || ids.has(id)) {
                id = uuidv4()
            }
            ids.add(id)
            return id
        }

        for (const delta of deltas) {
            let toBeSplitted = []
            let toBeRemoved = new Map<number, string>()
            let toBeClosed = new Set<[number, string]>()

            /* update text */
            const result = delta.apply(newText)
            if (result instanceof DeleteNonExistingText) {
                return result
            } else {
                newText = result
            }

            /* update segment */
            const direction = delta.insert.length - delta.remove.length
            const tmp = new Map<string, Map<string, Segment>>()
            for (const [id, segment] of newSegments) {
                if (segment.status == Status.Enabled) {
                    // Update enabled segment
                    if (delta.remove.length === 0) {
                        // Insert
                        if (delta.offset <= segment.offset) {
                            /*
                             *  ||    [segment]
                             * delta
                             */
                            newSegments.set(id, segment.move(direction))
                        } else if (delta.offset < segment.interval().end) {
                            /*
                             * [segment]
                             *    ||
                             *   delta
                             */
                            const [t1, t2] = segment.split([delta.offset])
                            const id1 = mkId()
                            const id2 = mkId()
                            tmp.set(id, new Map([[id1, t1], [id2, t2.move(direction)]]))
                        }
                    } else {
                        // Delte / Replace
                        if (delta.interval().end <= segment.offset) {
                            /*
                             * [delta]
                             *         [segment]
                             */
                            newSegments.set(id, segment.move(direction))
                        } else if (delta.offset < segment.offset && delta.interval().end < segment.interval().end) {
                            /*
                             * [delta]
                             *     [segment]
                             */
                            const [d, t1] = segment.split([delta.interval().end])
                            const id1 = mkId()
                            const id2 = mkId()
                            tmp.set(id, new Map([[id1, new Segment(delta.offset, d.text, Status.Disabled)], [id2, t1.move(direction)]]))

                            toBeSplitted.push(segment.offset)
                            toBeRemoved.set(segment.offset, id1)
                        } else if (segment.offset < delta.offset && delta.offset < segment.interval().end && segment.interval().end <= delta.interval().end) {
                            /*
                             *     [delta]
                             * [segment]
                             */
                            const [t1, d] = segment.split([delta.offset])
                            const id1 = mkId()
                            const id2 = mkId()
                            tmp.set(id, new Map([[id1, t1], [id2, new Segment(delta.offset, d.text, Status.Disabled)]]))

                            toBeSplitted.push(segment.interval().end)
                            toBeRemoved.set(delta.offset, id2)
                        } else if (segment.offset < delta.offset && delta.interval().end < segment.interval().end) {
                            /*
                             *  [delta]
                             * [segment]
                             */
                            const [t1, d, t2] = segment.split([delta.offset, delta.interval().end])
                            const id1 = mkId()
                            const id2 = mkId()
                            const id3 = mkId()
                            tmp.set(id, new Map([[id1, t1], [id2, new Segment(delta.offset, d.text, Status.Disabled)], [id3, t2.move(direction)]]))

                            toBeRemoved.set(delta.offset, id2)
                        } else if (delta.offset <= segment.offset && segment.interval().end <= delta.interval().end) {
                            /*
                             * [  delta  ]
                             *  [segment]
                             */
                            newSegments.set(id, new Segment(delta.offset, segment.text, Status.Disabled))

                            toBeSplitted.push(segment.offset, segment.interval().end)
                            toBeRemoved.set(segment.offset, id)
                        }
                    }
                } else {
                    // Disabled
                    if (delta.interval().end <= segment.offset) {
                        /*
                         * [delta]
                         *         [segment]
                         */
                        newSegments.set(id, segment.move(direction))
                    } else if (delta.offset < segment.offset && segment.offset <= delta.interval().end) {
                        /*
                         * [  delta  ]
                         *  [segment]
                         */
                        newSegments.set(id, segment.move(delta.offset - segment.offset))

                        // Close
                        toBeClosed.add([segment.offset, id])
                    }
                }
            }

            if (tmp.size !== 0) {
                for (const [id, newIds] of tmp) {
                    newSegments.delete(id)
                    splittedIds.set(id, [])
                    for (const [nid, nsegment] of newIds) {
                        newSegments.set(nid, nsegment)
                        splittedIds.get(id).push(nid)
                    }
                }
            }

            if (delta.remove.length !== 0) {
                const segment = new Segment(delta.offset, delta.remove, Status.Disabled)
                const ss = segment.split(toBeSplitted)
                ss.reverse()
                for (const segment of ss) {
                    let id = null
                    if (toBeRemoved.has(segment.offset)) {
                        id = toBeRemoved.get(segment.offset)

                    } else {
                        id = mkId()
                        newSegments.set(id, new Segment(delta.offset, segment.text, Status.Disabled))
                    }
                    remove.push(id)
                    const s = newSegments.get(id)
                    const begin = segment.offset
                    const end = begin + s.text.length

                    /* Closing */
                    for (const elem of toBeClosed) { // TODO inefficient (O(#Segment^2) in the worst case)
                        if (begin <= elem[0] && elem[0] < end) {
                            newClosing.addVertex(id)
                            newClosing.addVertex(elem[1])
                            newClosing.addEdge(id, elem[1], elem[0] - begin)
                            toBeClosed.delete(elem)
                        }
                    }
                }
            }
            if (delta.insert.length !== 0) {
                const id = mkId()
                newSegments.set(id, new Segment(delta.offset, delta.insert, Status.Enabled))
                insert.push(id)
            }
        }
        remove.reverse()
        insert.reverse()
        return new ApplyResult(new SegmentHistory(newSegments, to_immutable(newClosing), newText), diff, splittedIds, remove, insert)
    }
    /**
     * Applies operations to the source code, and updates the history
     *
     * @param operations The list of operations to be applied
     * @returns The result of applying diff
     */
    public apply_operations(operations: ReadonlyArray<[Operation, string]>): ApplyResult | DeleteNonExistingText {
        let newSegments = new Map(this.segments)
        let newClosing = to_mutable(this.closing)
        let remove = []
        let insert = [] as string[]
        let newText = this.text
        let diff = new Diff([])

        for (const [op, id] of operations) {
            const segment = newSegments.get(id) // TODO error handling
            const result = segment.apply(op)
            if (result !== null) {
                const [delta, newSegment] = result

                const toBeReopened = newClosing.successors(id)
                const direction = delta.insert.length - delta.remove.length
                for (const [id2, segment2] of newSegments) {
                    if (toBeReopened.has(id2)) {
                        // Reopen
                        newSegments.set(id2, new Segment(newSegment.offset + toBeReopened.get(id2), segment2.text, segment2.status))
                    } else {
                        if (segment.interval().end <= segment2.offset) {
                            newSegments.set(id2, segment2.move(direction))
                        }
                    }
                }

                newSegments.set(id, newSegment)

                /* Update newText and diff */
                const tmp = delta.apply(newText)
                if (tmp instanceof DeleteNonExistingText) {
                    return tmp
                }
                newText = tmp
                const newDiff = diff.then(new Diff([delta]))
                if (newDiff instanceof DeleteNonExistingText) {
                    return newDiff
                }
                diff = newDiff
                if (op == Operation.Disable) {
                    remove.push(id)
                } else {
                    insert.push(id)
                }
                newClosing.removeVertex(id)
            }
        }

        return new ApplyResult(new SegmentHistory(newSegments, to_immutable(newClosing), newText), diff, new Map(), remove, insert)
    }
}

export { Status, Operation, ApplyResult, Segment, SegmentHistory }
