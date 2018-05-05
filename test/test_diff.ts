import * as chai from 'chai'
const should = chai.should()

import { Delta } from '../src/diff'
import { ExecutionMode, ConstrainedData } from '../src/common'

describe('Delta', () => {
    describe('#validate', () => {
        it('non-negative offset is valid', () => {
            should.not.exist(new Delta(0, "", "").validate())
            should.not.exist(new Delta(1, "", "").validate())
        })
        it('negative is invalid', () => {
            ConstrainedData.mode = ExecutionMode.Release
            new Delta(-1, "", "").validate().should.equal("the offset is negative (-1)")
        })
    })
})