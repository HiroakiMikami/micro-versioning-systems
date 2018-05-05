import { ConstrainedData, Interval } from "./common"

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
     * @returns The interval that modified by this edit
     */
    public interval(): Interval { return new Interval(this.offset, this.remove.length) }

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

/** A conflict occurred when trying to delete the text that the previous diff already deletes */
class DeleteAlreadyDeletedText extends ConstrainedData {
    /**
     * @param offset The offset of the text
     * @param text The text already deleted
     */
    constructor (public offset: number, public text: string) { super() }
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

    /**
     * Re-calculate offsets on top of another base diff (like `git rebase`)
     *
     * @param base The new base diff
     * @returns The new diff that these offsets are calculated on top of `base`
     */
    public rebase(base: Diff): Diff | DeleteAlreadyDeletedText {
        let diff = 0
        let deltas = []
        let base_index = 0

        for (const delta of this.deltas) {
            while (base_index != base.deltas.length && base.deltas[base_index].offset < delta.offset) {
                const d = base.deltas[base_index]
                diff += d.insert.length - d.remove.length
                base_index += 1
            }

            let i1 = new Interval(-1, 0)
            if (base_index != 0 && base.deltas.length != 0) {
                i1 = base.deltas[base_index - 1].interval()
            }
            let i2 = new Interval(-1, 0)
            if (base_index < base.deltas.length) {
                i2 = base.deltas[base_index].interval()
            }

            const i = delta.interval()
            if (i.intersect(i1) != null) {
                // base.deltas[base_index - 1] and delta is overlapped
                const x = i.intersect(i1)
                return new DeleteAlreadyDeletedText(x.begin, delta.remove.substr(x.begin - delta.offset, x.length))
            }
            if (i.intersect(i2) != null) {
                // base.deltas[base_index] and delta is overlapped
                const x = i.intersect(i2)
                return new DeleteAlreadyDeletedText(x.begin, delta.remove.substr(x.begin - delta.offset, x.length))
            }

            deltas.push(new Delta(delta.offset + diff, delta.remove, delta.insert))
        }
        return new Diff(deltas)
    }

    public validate(): string | null {
        let i = new Interval(-1, 0)
        for (const delta of this.deltas) {
            const i1 = delta.interval()
            if (i.begin >= i1.begin) {
                // deltas should be sorted
                return `the deltas should be sorted (delta1: ${i}, delta2: ${i1})`
            }
            if (i.intersect(i1) != null) {
                // deltas should not have overlaps
                return `the deltas should not have overlaps (delta1: ${i}, delta2: ${i1})`
            }
            i = i1
        }
        return null
    }
}

export { Delta, Diff, DeleteAlreadyDeletedText }
