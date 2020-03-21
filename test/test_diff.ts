/* eslint-disable @typescript-eslint/explicit-function-return-type */
import * as chai from 'chai'
chai.should()

import * as u from './utils'
import { Delta, Diff, ModifyAlreadyModifiedText, DeleteNonExistingText } from '../src/diff'
import { Interval } from '../src/common'

describe('DeleteNonExistingText', () => {
    describe('validatation', () => {
        u.it('the object is invalid if the expected and the actual is same', () => {
            (() => new DeleteNonExistingText(0, "x", "y")).should.not.throw();
            (() => new DeleteNonExistingText(0, "x", "x")).should.throw()
        })
    })
})

describe('Delta', () => {
    describe('validation', () => {
        u.it('negative is invalid', () => {
            (() => new Delta(0, "", "x")).should.not.throw();
            (() => new Delta(1, "", "x")).should.not.throw();
            (() => new Delta(-1, "", "x")).should.throw();
        })
        u.it('the remove and the insert should not be same', () => {
            (() => new Delta(1, "", "x")).should.not.throw();
            (() => new Delta(0, "x", "x")).should.throw()
        })
    })
    describe('#apply', () => {
        u.it('return the modified text', () => {
            new Delta(1, "23", "").apply("1234").should.equal("14")
            new Delta(1, "", "ab").apply("1234").should.equal("1ab234")
            new Delta(1, "23", "ab").apply("1234").should.equal("1ab4")
        })
        u.it('return conflict when the operation is impossible', () => {
            new Delta(1, "23", "").apply("1ab4").should.deep.equal(new DeleteNonExistingText(1, "23", "ab"))
        })
    })
    describe('#interval', () => {
        u.it('return the range to be deleted', () => {
            new Delta(0, "xx", "").interval().should.deep.equal(new Interval(0, 2))
            new Delta(0, "xx", "x").interval().should.deep.equal(new Interval(0, 2))
        })
    })
})

describe('Diff', () => {
    describe('validation', () => {
        u.it('deltas should be sorted by offsets', () => {
            (() => new Diff([new Delta(0, "", "x"), new Delta(1, "", "x")])).should.not.throw();
            (() => new Diff([new Delta(1, "", "x"), new Delta(0, "", "x")])).should.throw()
        })
        u.it('deltas should not have overlaps', () => {
            (() => new Diff([new Delta(0, "", "x"), new Delta(1, "", "x")])).should.not.throw();
            (() => new Diff([new Delta(0, "y", "x"), new Delta(2, "", "x")])).should.not.throw();
            (() => new Diff([new Delta(0, "x", ""), new Delta(1, "", "y")])).should.throw();
            (() => new Diff([new Delta(0, "", "x"), new Delta(0, "", "x")])).should.throw();
            (() => new Diff([new Delta(0, "xx", ""), new Delta(1, "", "x")])).should.throw()
        })
    })

    describe('#inverse', () => {
        u.it('swap remove and insert of each delta', () => {
            const orig = new Diff([new Delta(0, "x", "y"), new Delta(2, "s", "t")])
            const inverse = orig.inverse()
            inverse.deltas.should.deep.equal([new Delta(0, "y", "x"), new Delta(2, "t", "s")])
        })
        u.it('adjust offsets', () => {
            const orig = new Diff([new Delta(0, "x", "xx"), new Delta(2, "yy", "y"), new Delta(5, "w", "z")])
            const inverse = orig.inverse()

            /* Example
             * - the target text "x-yy-w"
             * - `orig` is applied: "xx-y-z"
             * - `orig.inverse` is applied to "xx-y-z": "x-yy-w"
             *
             * => The inverse operation should modify a text "xx-y-z" to "x-yy-w".
             */
            inverse.deltas.should.deep.equal([new Delta(0, "xx", "x"), new Delta(3, "y", "yy"), new Delta(5, "z", "w")])
        })
    })

    describe('#rebase', () => {
        u.it('return the same diff it the base is empty diff', () => {
            const target = new Diff([new Delta(1, "s", "ss"), new Delta(4, "tt", "t")])
            target.rebase(new Diff([])).should.deep.equal(target)
        })
        u.it('adjust offsets using the base diff', () => {
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
        u.it('return conflict if the modified range is overlapped', () => {
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
        u.it('merge two diffs into one diff', () => {
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
        u.it('merge two diffs with conflicts into one diff (delete)', () => {
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
        u.it('merge two diffs with conflicts into one diff (insert)', () => {
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

            const d41 = new Diff([new Delta(0, "", "xz")])
            const d42 = new Diff([new Delta(1, "", "y")])
            /* Example,
             * - the target text: ""
             * - d41 is applied: "xz"
             * - d42 is applied: "xyz"
             *
             * => `d41.then(d42)` should modify a text "" to "xyz"
             */
            d41.then(d42).should.deep.equal(new Diff([new Delta(0, "", "xyz")]))
        })
        u.it('merge two diffs with conflicts into one diff (replace)', () => {
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
        u.it('merge two diffs with conflicts into one diff', () => {
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
        u.it('return conflict when the operation is impossible', () => {
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
