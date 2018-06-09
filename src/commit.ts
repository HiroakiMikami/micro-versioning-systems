import { ConstrainedData, Status, Operation } from "./common"

class Commit extends ConstrainedData {
    constructor(public readonly remove: ReadonlyArray<string>,
                public readonly insert: ReadonlyArray<string>,
                public readonly timestamps: ReadonlySet<Date>,
                public readonly status: Status) {
        super(() => {
            /* remove and insert have no intersection */
            const ids = new Set(remove.concat(insert))
            if (ids.size === 0) {
                return `there are no segments in this commit`
            }
            if (ids.size !== remove.length + insert.length) {
                return `there are some duplicated segments`
            }

            /* timestamps should not be empty */
            if (timestamps.size ==- 0) {
                return `the set of timestamps is empty`
            }

            return null
        })
    }
    public toggle(): ReadonlyArray<[Operation, string]> {
        let retval: [Operation, string][] = []
        if (this.status === Status.Enabled) {
            for (const id of this.remove) {
                retval.push([Operation.Enable, id])
            }
            for (const id of this.insert) {
                retval.push([Operation.Disable, id])
            }
        } else {
            for (const id of this.insert) {
                retval.push([Operation.Enable, id])
            }
            for (const id of this.remove) {
                retval.push([Operation.Disable, id])
            }
        }
        retval.reverse()
        return retval
    }
}

export { Commit }
