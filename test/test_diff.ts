import * as chai from 'chai'
const should = chai.should()

import { Delta, Diff, ModifyAlreadyModifiedText, DeleteNonExistingText } from '../src/diff'
import { ExecutionMode, ConstrainedData, Interval } from '../src/common'

describe('DeleteNonExistingText', () => {
    describe('#validate', () => {
        ConstrainedData.mode = ExecutionMode.Release
        it('the object is invalid if the expected and the actual is same', () => {
            should.not.exist(new DeleteNonExistingText(0, "x", "y").validate())
            new DeleteNonExistingText(0, "x", "x").validate().should.equal("the expected text and the actual text is same (x)")
        })
    })
})

describe('Delta', () => {
    describe('#validate', () => {
        ConstrainedData.mode = ExecutionMode.Release
        it('negative is invalid', () => {
            should.not.exist(new Delta(0, "", "x").validate())
            should.not.exist(new Delta(1, "", "x").validate())
            new Delta(-1, "", "x").validate().should.equal("the offset is negative (-1)")
        })
        it('the remove and the insert should not be same', () => {
            should.not.exist(new Delta(1, "", "x").validate())
            new Delta(0, "x", "x").validate().should.equal("the delete text and the insert text is same (x->x)")
        })
    })
    describe('#interval', () => {
        ConstrainedData.mode = ExecutionMode.Debug
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
            should.not.exist(new Diff([new Delta(0, "", "x"), new Delta(1, "", "x")]).validate())
            new Diff([new Delta(1, "", "x"), new Delta(0, "", "x")]).validate()
                .should.equal("the deltas should be sorted (delta1: [1:1), delta2: [0:0))")
        })
        it('deltas should not have overlaps', () => {
            should.not.exist(new Diff([new Delta(0, "", "x"), new Delta(1, "", "x")]).validate())
            should.not.exist(new Diff([new Delta(0, "y", "x"), new Delta(2, "", "x")]).validate())
            new Diff([new Delta(0, "x", ""), new Delta(1, "", "y")]).validate()
                .should.equal("the deltas should not have overlaps (delta1: [0:1), delta2: [1:1))")
            new Diff([new Delta(0, "", "x"), new Delta(0, "", "x")]).validate()
                .should.equal("the deltas should not have overlaps (delta1: [0:0), delta2: [0:0))")
            new Diff([new Delta(0, "xx", ""), new Delta(1, "", "x")]).validate()
                .should.equal("the deltas should not have overlaps (delta1: [0:2), delta2: [1:1))")
        })
    })

    describe('#inverse', () => {
        ConstrainedData.mode = ExecutionMode.Debug
        it('swap remove and insert of each delta', () => {
            const orig = new Diff([new Delta(0, "x", "y"), new Delta(2, "s", "t")])
            const inverse = orig.inverse()
            inverse.deltas.should.deep.equal([new Delta(0, "y", "x"), new Delta(2, "t", "s")])
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
            inverse.deltas.should.deep.equal([new Delta(0, "xxyz", "xyyz")])
        })
    })

    describe('#rebase', () => {
        ConstrainedData.mode = ExecutionMode.Debug
        it('return the same diff it the base is empty diff', () => {
            const target = new Diff([new Delta(1, "s", "ss"), new Delta(4, "tt", "t")])
            target.rebase(new Diff([])).should.deep.equal(target)
        })
        it('adjust offsets using the base diff', () => {
            const base = new Diff([new Delta(0, "x", "xx"), new Delta(2, "yy", "y"), new Delta(6, "zz", "z")])
            const target = new Diff([new Delta(1, "s", "ss"), new Delta(4, "tt", "t")])
            /* Example,
             * - the target text: "xsyyttzz"
             * - base is applied: "xxsyttz"
             * - base and target are applied: "xxssytz"
             *
             * => `target.rebase(base)` should modify a text "xxsyttz" to "xxssytz"
             */
            const rebased = target.rebase(base)
            rebased.should.deep.equal(new Diff([new Delta(2, "s", "ss"), new Delta(4, "tt", "t")]))
        })
        it('return conflict if the modified range is overlapped', () => {
            const base = new Diff([new Delta(0, "x", "xx"), new Delta(2, "yy", "y"), new Delta(6, "zz", "z")])
            /* A conflict is occurred because both base and target1 remove "x" */
            const target1 = new Diff([new Delta(0, "x", "ss"), new Delta(4, "tt", "t")])
            const rebased1 = target1.rebase(base)
            rebased1.should.deep.equal(new ModifyAlreadyModifiedText(0, "x"))

             /* A conflict is occurred because both base and target2 remove "y" */
            const target2 = new Diff([new Delta(1, "x", "ss"), new Delta(3, "yt", "t")])
            const rebased2 = target2.rebase(base)
            rebased2.should.deep.equal(new ModifyAlreadyModifiedText(3, "y"))

            /* A conflict is occurred because both base and target3 remove "z" */
            const target3 = new Diff([new Delta(1, "x", "ss"), new Delta(5, "tz", "t")])
            const rebased3 = target3.rebase(base)
            rebased3.should.deep.equal(new ModifyAlreadyModifiedText(6, "z"))

            const base4 = new Diff([new Delta(0, "xx", "")])
            const target4 = new Diff([new Delta(1, "", "ss")])
            const rebased4 = target4.rebase(base4)
            rebased4.should.deep.equal(new ModifyAlreadyModifiedText(1, ""))

            const base5 = new Diff([new Delta(0, "", "xx")])
            const target5 = new Diff([new Delta(0, "", "ss")])
            const rebased5 = target5.rebase(base5)
            rebased5.should.deep.equal(new ModifyAlreadyModifiedText(0, ""))

            const base6 = new Diff([new Delta(0, "", "xx")])
            const target6 = new Diff([new Delta(0, "ss", "")])
            const rebased6 = target6.rebase(base6)
            rebased6.should.deep.equal(new ModifyAlreadyModifiedText(0, ""))
        })
    })

    describe('#then', () => {
        ConstrainedData.mode = ExecutionMode.Debug
        it('merge two diffs into one diff', () => {
            const d1 = new Diff([new Delta(0, "x", "xx"), new Delta(2, "yy", "y"), new Delta(10, "zz", "z")])
            const d2 = new Diff([new Delta(2, "s", "ss"), new Delta(4, "tt", "t")])

            /* Example,
             * - the target text: "xsyytt...zz"
             * - d1 is applied: "xxsytt...z"
             * - d2 is applied: "xxssyt...z"
             *
             * => `d1.then(d2)` should modify a text "xsyytt...zz" to "xxssyt...z"
             */
            d1.then(d2).should.deep.equal(
                new Diff([new Delta(0, "xsyytt", "xxssyt"), new Delta(10, "zz", "z")]))
        })
        it('merge two diffs with conflicts into one diff (delete)', () => {
            const d11 = new Diff([new Delta(2, "x", "")])
            const d12 = new Diff([new Delta(1, "yy", "")])

            /* Example,
             * - the target text: "ayxy"
             * - d11 is applied: "ayy"
             * - d12 is applied: "a"
             *
             * => `d11.then(d12)` should modify a text "ayxy" to "a"
             */
            d11.then(d12).should.deep.equal(new Diff([new Delta(1, "yxy", "")]))
        })
        it('merge two diffs with conflicts into one diff (insert)', () => {
            const d11 = new Diff([new Delta(1, "", "xx")])
            const d12 = new Diff([new Delta(2, "xy", "")])
            /* Example,
             * - the target text: "ay"
             * - d11 is applied: "axxy"
             * - d12 is applied: "ax"
             *
             * => `d11.then(d12)` should modify a text "ay" to "ax"
             */
            d11.then(d12).should.deep.equal(new Diff([new Delta(1, "y", "x")]))

            const d21 = new Diff([new Delta(2, "", "x")])
            const d22 = new Diff([new Delta(1, "yxy", "")])
            /* Example,
             * - the target text: "ayy"
             * - d21 is applied: "ayxy"
             * - d22 is applied: "a"
             *
             * => `d21.then(d22)` should modify a text "ayy" to "a"
             */
            d21.then(d22).should.deep.equal(new Diff([new Delta(1, "yy", "")]))

            const d31 = new Diff([new Delta(2, "", "xx")])
            const d32 = new Diff([new Delta(1, "yx", "")])
            /* Example,
             * - the target text: "ay"
             * - d31 is applied: "ayxx"
             * - d32 is applied: "ax"
             *
             * => `d31.then(d32)` should modify a text "ay" to "ax"
             */
            d31.then(d32).should.deep.equal(new Diff([new Delta(1, "y", "x")]))
        })
        it('merge two diffs with conflicts into one diff (replace)', () => {
            const d11 = new Diff([new Delta(1, "s", "xx")])
            const d12 = new Diff([new Delta(2, "xy", "")])
            /* Example,
             * - the target text: "asy"
             * - d11 is applied: "axxy"
             * - d12 is applied: "ax"
             *
             * => `d11.then(d12)` should modify a text "asy" to "ax"
             */
            d11.then(d12).should.deep.equal(new Diff([new Delta(1, "sy", "x")]))

            const d21 = new Diff([new Delta(2, "s", "x")])
            const d22 = new Diff([new Delta(1, "yxy", "")])
            /* Example,
             * - the target text: "aysy"
             * - d21 is applied: "ayxy"
             * - d22 is applied: "a"
             *
             * => `d21.then(d22)` should modify a text "aysy" to "a"
             */
            d21.then(d22).should.deep.equal(new Diff([new Delta(1, "ysy", "")]))

            const d31 = new Diff([new Delta(2, "s", "xx")])
            const d32 = new Diff([new Delta(1, "yx", "")])
            /* Example,
             * - the target text: "ays"
             * - d31 is applied: "ayxx"
             * - d32 is applied: "ax"
             *
             * => `d31.then(d32)` should modify a text "ays" to "ax"
             */
            d31.then(d32).should.deep.equal(new Diff([new Delta(1, "ys", "x")]))
        })
        it('merge two diffs with conflicts into one diff', () => {
            const d1 = new Diff([new Delta(1, "1", "xx"), new Delta(3, "3", "yy"), new Delta(5, "5", "zz")])
            const d2 = new Diff([new Delta(2, "x2yy4z", "")])
            /* Example,
             * - the target text: "a12345"
             * - d1 is applied: "axx2yy4zz"
             * - d2 is applied: "axz"
             *
             * => `d1.then(d2)` should modify a text "a12345" to "axz"
             */
            d1.then(d2).should.deep.equal(new Diff([new Delta(1, "12345", "xz")]))
        })
        it('return conflict when the operation is impossible', () => {
            const d1 = new Diff([new Delta(2, "1", "xx")])
            const d2 = new Diff([new Delta(1, "1yy", "")])
            /* Example,
             * - the target text: "a1"
             * - d1 is applied: "a1xx"
             * - d2 is applied: try to delete "yy", but the text does not contain 'yy'
             *
             * => `d1.then(d2)` should return conflict
             */
            d1.then(d2).should.deep.equal(new DeleteNonExistingText(2, "yy", "xx"))
        })
    })
})
