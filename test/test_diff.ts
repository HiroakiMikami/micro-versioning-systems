import * as chai from 'chai'
const should = chai.should()

import { Delta, Diff, DeleteAlreadyDeletedText } from '../src/diff'
import { ExecutionMode, ConstrainedData, Interval } from '../src/common'
import { fail } from 'assert';

describe('Delta', () => {
    describe('#validate', () => {
        ConstrainedData.mode = ExecutionMode.Release
        it('non-negative offset is valid', () => {
            should.not.exist(new Delta(0, "", "").validate())
            should.not.exist(new Delta(1, "", "").validate())
        })
        it('negative is invalid', () => {
            new Delta(-1, "", "").validate().should.equal("the offset is negative (-1)")
        })
    })
    describe('#interval', () => {
        it('return the range to be deleted', () => {
            new Delta(0, "xx", "").interval().should.deep.equal(new Interval(0, 2))
            new Delta(0, "xx", "x").interval().should.deep.equal(new Interval(0, 2))
        })
    })
})

describe('Diff', () => {
    describe('#validate', () => {
        ConstrainedData.mode = ExecutionMode.Release
        it('deltas should be sorted by offsets', () => {
            should.not.exist(new Diff([new Delta(0, "", ""), new Delta(1, "", "")]).validate())
            new Diff([new Delta(0, "", ""), new Delta(0, "", "")]).validate()
                .should.equal("the deltas should be sorted (delta1: [0:0), delta2: [0:0))")
            new Diff([new Delta(1, "", ""), new Delta(0, "", "")]).validate()
                .should.equal("the deltas should be sorted (delta1: [1:1), delta2: [0:0))")
        })
        it('deltas should not have overlaps', () => {
            should.not.exist(new Diff([new Delta(0, "", ""), new Delta(1, "", "")]).validate())
            should.not.exist(new Diff([new Delta(0, "x", ""), new Delta(1, "", "")]).validate())
            new Diff([new Delta(0, "xx", ""), new Delta(1, "", "")]).validate()
                .should.equal("the deltas should not have overlaps (delta1: [0:2), delta2: [1:1))")
        })
    })

    describe('#inverse', () => {
        it('swap remove and insert of each delta', () => {
            const orig = new Diff([new Delta(0, "x", "y"), new Delta(1, "s", "t")])
            const inverse = orig.inverse()
            inverse.deltas.should.deep.equal([new Delta(0, "y", "x"), new Delta(1, "t", "s")])
        })
        it('adjust offsets', () => {
            const orig = new Diff([new Delta(0, "x", "xx"), new Delta(1, "yy", "y"), new Delta(3, "z", "z")])
            const inverse = orig.inverse()

            /* Example
             * - the target text "xyyz"
             * - `orig` is applied: "xxyz"
             * - `orig.inverse` is applied to "xxyz": "xyyz"
             *
             * => The inverse operation should modify a text "xxyz" to "xyyz".
             */
            inverse.deltas.should.deep.equal([new Delta(0, "xx", "x"), new Delta(2, "y", "yy"), new Delta(3, "z", "z")])
        })
    })

    describe('#rebase', () => {
        it('return the same diff it the base is empty diff', () => {
            const target = new Diff([new Delta(1, "s", "ss"), new Delta(4, "tt", "t")])
            target.rebase(new Diff([])).should.deep.equal(target)
        })
        const base = new Diff([new Delta(0, "x", "xx"), new Delta(2, "yy", "y"), new Delta(6, "zz", "z")])
        it('adjust offsets using the base diff', () => {
            const target = new Diff([new Delta(1, "s", "ss"), new Delta(4, "tt", "t")])

            /* Example,
             * - the target text: "xsyyttzz"
             * - base is applied: "xxsyttz"
             * - base and target are applied: "xxssytz"
             *
             * => `target.rebase(base)` should modify a text "xxsyttz" to "xxssytz"
             */
            const rebased = target.rebase(base)
            if (rebased instanceof Diff) {
                rebased.deltas.should.deep.equal([new Delta(2, "s", "ss"), new Delta(4, "tt", "t")])
            } else {
                fail("rebase should return a Diff object")
            }
        })
        it('return conflict if the removed range is overlapped', () => {
            /* A conflict is occurred because both base and target1 remove "x" */
            const target1 = new Diff([new Delta(0, "x", "ss"), new Delta(4, "tt", "t")])
            const rebased1 = target1.rebase(base)
            if (rebased1 instanceof DeleteAlreadyDeletedText) {
                rebased1.should.deep.equal(new DeleteAlreadyDeletedText(0, "x"))
            } else {
                fail("rebase should return conflict")
            }

             /* A conflict is occurred because both base and target2 remove "y" */
            const target2 = new Diff([new Delta(1, "x", "ss"), new Delta(3, "yt", "t")])
            const rebased2 = target2.rebase(base)
            if (rebased2 instanceof DeleteAlreadyDeletedText) {
                rebased2.should.deep.equal(new DeleteAlreadyDeletedText(3, "y"))
            } else {
                fail("rebase should return conflict")
            }

            /* A conflict is occurred because both base and target3 remove "z" */
            const target3 = new Diff([new Delta(1, "x", "ss"), new Delta(5, "tz", "t")])
            const rebased3 = target3.rebase(base)
            if (rebased3 instanceof DeleteAlreadyDeletedText) {
                rebased3.should.deep.equal(new DeleteAlreadyDeletedText(6, "z"))
            } else {
                fail("rebase should return conflict")
            }
        })
    })
})
