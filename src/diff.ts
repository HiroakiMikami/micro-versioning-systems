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

export { Delta }
