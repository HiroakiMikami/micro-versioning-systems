import { ConstrainedData } from "./common"

/** A textual edit */
class Delta extends ConstrainedData {
    /**
     * @param offset The offset that this edit is applied
     * @param remove The string to be deleted
     * @param insert The string to be inserted
     */
    constructor (public readonly offset: number, public readonly remove: string | null, public readonly insert: string | null) {
        super()
    }

    /**
     * Checks whether the offset of this object is not negative (a negative offset is invalid).
     * 
     * @returns whether this object is valid or not
     */
    public validate(): string | null {
        if (this.offset >= 0) {
            return null
        } else {
            return `the offset is negative (${this.offset})`
        }
    }
}

/** A complex text manipulation */
class Diff extends ConstrainedData {
    /**
     * @param deltas The textual edits to be applied
     */
    constructor (public readonly deltas: Delta[]) { super() }

    /**
     * @returns An inverse manipulation
     */
    public inverse(): Diff {
        let diff = 0
        let inversed_deltas = []
        for (const delta of this.deltas) {
            const idelta = new Delta(delta.offset + diff, delta.insert, delta.remove)
            diff += delta.insert.length - delta.remove.length
            inversed_deltas.push(idelta)
        }
        return new Diff(inversed_deltas)
    }

    public validate(): string | null {
        let start = -1
        let end = -1
        for (const delta of this.deltas) {
            const s1 = delta.offset
            const e1 = delta.offset + delta.remove.length
            if (start >= s1) {
                // deltas should be sorted
                return `the deltas should be sorted (delta1: [${start}:${end}), delta2: [${s1}:${e1}))`
            }
            if (end > s1) {
                // deltas should not have overlaps
                return `the deltas should not have overlaps (delta1: [${start}:${end}), delta2: [${s1}:${e1}))`
            }
            start = s1
            end = e1
        }
        return null
    }
}

export { Delta, Diff }
