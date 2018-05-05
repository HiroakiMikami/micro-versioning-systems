import * as chai from 'chai'
const should = chai.should()

import { Delta, Diff } from '../src/diff'
import { ExecutionMode, ConstrainedData } from '../src/common'

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
})
