import * as chai from 'chai'
const should = chai.should()

import { ConstrainedData, Interval } from '../src/common'
import * as u from './utils'

class InvalidData extends ConstrainedData {}

describe('ConstrainedData', () => {
    describe('#constructor', () => {
        u.it('run assert if the execution mode is Debug', () => {
            (() => { new InvalidData(() => "") }).should.throw()
        })
        u.it_release('ignore invalid data structure if the execution mode is Release', () => {
            (() => { new InvalidData(() => "") }).should.not.throw()
        })
    })
})

describe('Interval', () => {
    describe('validatation', () => {
        u.it('the negative length is invalid', () => {
            (() => new Interval(0, -1)).should.throw();
            (() => new Interval(0, 0)).should.not.throw();
            (() => new Interval(0, 1)).should.not.throw();
        })
    })
    describe('#toString', () => {
        u.it('represent the interval', () => {
            new Interval(0, 1).toString().should.equal("[0:1)")
            const str = `${new Interval(0, 1)}`
            str.should.equal("[0:1)")
        })
    })

    describe('#intersect', () => {
        u.it('returns the intersection', () => {
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
