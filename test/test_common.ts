import * as chai from 'chai'
const should = chai.should()

import { ExecutionMode, ConstrainedData, Interval } from '../src/common'

class InvalidData extends ConstrainedData {
    public validate(): string | null { return "error" }
}

describe('ConstrainedData', () => {
    describe('#constructor', () => {
        it('run assert if the execution mode is Debug', () => {
            ConstrainedData.mode = ExecutionMode.Debug;
            (() => { new InvalidData() }).should.throw()
        })
        it('ignore invalid data structure if the execution mode is Release', () => {
            ConstrainedData.mode = ExecutionMode.Release;
            (() => { new InvalidData() }).should.not.throw()
        })
    })
})

describe('Interval', () => {
    describe('#validate', () => {
        it('the negative length is invalid', () => {
            new Interval(0, -1).validate().should.equal("the length is negative (-1)")
            should.not.exist(new Interval(0, 0).validate())
            should.not.exist(new Interval(0, 1).validate())
        })
    })
    describe('#toString', () => {
        it('represent the interval', () => {
            new Interval(0, 1).toString().should.equal("[0:1)")
            const str = `${new Interval(0, 1)}`
            str.should.equal("[0:1)")
        })
    })

    describe('#intersect', () => {
        it('returns the intersection', () => {
            new Interval(0, 2).intersect(new Interval(0, 2)).should.deep.equal(new Interval(0, 2))
            new Interval(0, 2).intersect(new Interval(1, 1)).should.deep.equal(new Interval(1, 1))
            new Interval(0, 1).intersect(new Interval(0, 2)).should.deep.equal(new Interval(0, 1))
            new Interval(0, 2).intersect(new Interval(1, 2)).should.deep.equal(new Interval(1, 1))
            new Interval(1, 2).intersect(new Interval(0, 2)).should.deep.equal(new Interval(1, 1))

            new Interval(1, 2).intersect(new Interval(1, 0)).should.deep.equal(new Interval(1, 0))
            new Interval(1, 0).intersect(new Interval(1, 0)).should.deep.equal(new Interval(1, 0))

            should.not.exist(new Interval(0, 1).intersect(new Interval(1, 2)))
            should.not.exist(new Interval(2, 3).intersect(new Interval(0, 1)))
        })
    })
})
