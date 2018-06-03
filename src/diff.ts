import { ConstrainedData, Interval } from "./common"

/** A conflict occurred when trying to modified the text that the previous diff already modifies */
class ModifyAlreadyModifiedText extends ConstrainedData {
    /**
     * @param offset The offset of the text
     * @param text The text already deleted
     */
    constructor (public offset: number, public text: string) {
        super(() => {
            if (offset < 0) {
                return `the offset is negative (${this.offset})`
            }
            return null
        })
    }
}

/** A conflict occurred when trying to delete the non-existing text */
class DeleteNonExistingText extends ConstrainedData {
    /**
     * @param offset The offset of the text
     * @param expected The text to be deleted
     * @param actual The actual text
     */
    constructor (public offset: number, public expected: string, public actual: string) {
        super(() => {
            if (offset < 0) {
                return `the offset is negative (${offset})`
            }

            if (expected == actual) {
                return `the expected text and the actual text is same (${expected})`
            }
            return null
        })
    }
}

/** A textual edit */
class Delta extends ConstrainedData {
    /**
     * @param offset The offset that this edit is applied
     * @param remove The string to be deleted
     * @param insert The string to be inserted
     */
    constructor (public readonly offset: number, public readonly remove: string | null, public readonly insert: string | null) {
        super(() => {
            if (offset < 0) {
                return `the offset is negative (${offset})`
            }
            if (remove == insert) {
                return `the delete text and the insert text is same (${remove}->${insert})`
            }
            return null
        })
    }

    /**
     * @returns The modified text
     */
    public apply(target: string): string | DeleteNonExistingText {
        const t1 = target.slice(0, this.offset)
        const deleted = target.slice(this.offset, this.offset + this.remove.length)
        const t2 = target.slice(this.offset + this.remove.length)

        if (deleted !== this.remove) {
            return new DeleteNonExistingText(this.offset, this.remove, deleted)
        }
        return t1 + this.insert + t2
    }

    /**
     * @returns The interval that the text to be modified by this edit
     */
    public interval(): Interval { return new Interval(this.offset, this.remove.length) }

    public toString(): string {
        return `${this.offset}: \"${this.remove || ""}\" -> \"${this.insert || ""}\"`
    }
}

/** A complex text manipulation */
class Diff extends ConstrainedData {
    /**
     * @param deltas The textual edits to be applied
     */
    constructor (public readonly deltas: ReadonlyArray<Delta>) {
        super(() => {
            let i = new Interval(-1, 0)
            for (const delta of deltas) {
                const i1 = delta.interval()
                if (i.intersect(i1) != null || i.end == i1.begin) {
                    // deltas should not have overlaps
                    return `the deltas should not have overlaps (delta1: ${i}, delta2: ${i1})`
                }
                if (i.begin >= i1.begin) {
                    // deltas should be sorted
                    return `the deltas should be sorted (delta1: ${i}, delta2: ${i1})`
                }
                i = i1
            }
            return null
        })
    }

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
        return new Diff(Diff.normalize(inversed_deltas))
    }

    /**
     * Re-calculate offsets on top of another base diff (like `git rebase`)
     *
     * @param base The new base diff
     * @returns The new diff that these offsets are calculated on top of `base`
     */
    public rebase(base: Diff): Diff | ModifyAlreadyModifiedText {
        let diff = 0
        let deltas = []
        let base_index = 0

        for (const delta of this.deltas) {
            /* skip unrelated base deltas and update the offset difference */
            while (base_index != base.deltas.length && base.deltas[base_index].offset < delta.offset) {
                const d = base.deltas[base_index]
                diff += d.insert.length - d.remove.length
                base_index += 1
            }

            /* check whether `base` and `this` are conflicted or not */
            const i = delta.interval()
            if (base_index != 0 && base.deltas.length != 0) {
                const i1 = base.deltas[base_index - 1].interval()
                if (i.intersect(i1) != null) {
                    // base.deltas[base_index - 1] and delta is overlapped
                    const x = i.intersect(i1)
                    return new ModifyAlreadyModifiedText(x.begin, delta.remove.substr(x.begin - delta.offset, x.length))
                }
            }
            if (base_index < base.deltas.length) {
                const i2 = base.deltas[base_index].interval()
                if (i.intersect(i2) != null) {
                    // base.deltas[base_index] and delta is overlapped
                    const x = i.intersect(i2)
                    return new ModifyAlreadyModifiedText(x.begin, delta.remove.substr(x.begin - delta.offset, x.length))
                }
            }

            /* add the re-calculated delta */
            deltas.push(new Delta(delta.offset + diff, delta.remove, delta.insert))
        }
        return new Diff(Diff.normalize(deltas))
    }

    /**
     * Merge the two diffs into one diff
     *
     * @param next the diff applied in 2nd step
     * @returns The new diff that applies `this` first, then applies `next`
     */
    public then(next: Diff): Diff | DeleteNonExistingText {
        let deltas = []

        let diff = 0
        let index = 0
        for (const delta of next.deltas) {
            /* skip unrelated `this` deltas and update the offset difference*/
            while (index != this.deltas.length) {
                const d = this.deltas[index]
                const end = d.offset + diff + d.insert.length
                if (end > delta.offset) {
                    break
                }
                diff += d.insert.length - d.remove.length
                index += 1
                deltas.push(d)
            }
            /* get conflicted deltas */
            let conflicted = []
            let tmp_diff = 0
            while (index != this.deltas.length) {
                const d = this.deltas[index]
                const i = new Interval(d.offset + diff, d.insert.length)
                if (!i.intersect(delta.interval())) {
                    break
                }
                conflicted.push(new Delta(d.offset + tmp_diff, d.remove, d.insert))
                tmp_diff += d.insert.length - d.remove.length

                index += 1
            }

            /* create merged delta */
            // initial value
            let offset = delta.offset - diff
            let remove = delta.remove
            let insert = delta.insert

            for (const c of conflicted.reverse()) {
                /* resolve conflit between c and this */
                // Interval based on the text after applying c
                const i_d = new Interval(offset, remove.length)
                const i_c = new Interval(c.offset, c.insert.length)

                offset =  Math.min(i_d.begin, i_c.begin) //< update a offset

                // update insert if c's insert is remained in the final text
                if (i_c.begin < i_d.begin) {
                    insert = c.insert.slice(0, i_d.begin - i_c.begin) + insert
                } else if (i_d.end < i_c.end) {
                    insert = insert + c.insert.slice(i_d.end - i_c.begin)
                }

                // update delete
                const b = Math.max(i_d.begin, i_c.begin)
                const e = Math.min(i_d.end, i_c.end)
                const actual = c.insert.slice(Math.max(b - i_c.begin, 0), e - i_c.begin)
                const expected = remove.slice(Math.max(b - i_d.begin, 0), e - i_d.begin)
                // actual and expected should be same because `actual` in `c.insert` is deleted by `delta.remove`
                if (actual != expected) {
                    // `delete.remove` try to remove a non-exsiting text
                    return new DeleteNonExistingText(b, expected, actual)
                }
                // remove `expected` from `remove`, and insert `c.remove` to `remove`
                remove = remove.slice(0, Math.max(b - i_d.begin, 0)) + c.remove + remove.slice(e - i_d.begin)
            }

            /* add the re-calculated delta */
            deltas.push(new Delta(offset, remove, insert))
        }

        /* add the remained deltas in `this` */
        for (let i = index; i < this.deltas.length; ++i) {
            deltas.push(this.deltas[i])
        }

        return new Diff(Diff.normalize(deltas))
    }

    private static normalize(deltas: Delta[]): Delta[] {
        let new_deltas: Delta[] = []
        for (const delta of deltas) {
            if (new_deltas.length == 0) {
                new_deltas.push(delta)
            } else {
                const d = new_deltas[new_deltas.length - 1]
                if (d.interval().end == delta.offset) {
                    new_deltas.pop()
                    new_deltas.push(new Delta(d.offset, d.remove + delta.remove, d.insert + delta.insert))
                } else {
                    new_deltas.push(delta)
                }
            }
        }
        return new_deltas
    }
}

export { Delta, Diff, ModifyAlreadyModifiedText, DeleteNonExistingText }
