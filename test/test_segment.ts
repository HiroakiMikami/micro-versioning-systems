import * as chai from 'chai'
const should = chai.should()

import * as u from "./utils"
import { Interval } from '../src/common'
import { Delta } from '../src/diff'
import { Segment, Status, Operation } from '../src/segment'

describe('Segment', () => {
    describe('validation', () => {
        u.it('the object is invalid if the offset is negative', () => {
            (() => new Segment(0, "x", Status.Enabled)).should.not.throw();
            (() => new Segment(-1, "x", Status.Enabled)).should.throw()
        })
        u.it('the object is invalid if the text is empty', () => {
            (() => new Segment(0, "x", Status.Enabled)).should.not.throw();
            (() => new Segment(0, "", Status.Enabled)).should.throw()
        })
    })
    describe('#interval', () => {
        u.it('return the interval of the text that modified by this segment', () => {
            new Segment(1, "xxx", Status.Disabled).interval().should.deep.equal(new Interval(1, 0))
            new Segment(1, "xxx", Status.Enabled).interval().should.deep.equal(new Interval(1, 3))
        })
    })
    describe('#move', () => {
        u.it('update the offset of the segment', () => {
            const segment = new Segment(1, "xxx", Status.Disabled)
            segment.move(-1).should.deep.equal(new Segment(0, "xxx", Status.Disabled))
            segment.move(0).should.deep.equal(segment)
            segment.move(1).should.deep.equal(new Segment(2, "xxx", Status.Disabled))
        })
    })
    describe('#apply', () => {
        u.it('return a delta that inserts the text if operation is Enable', () => {
            const s1 = new Segment(1, "xxx", Status.Disabled)
            s1.apply(Operation.Enable)[0].should.deep.equal(new Delta(1, "", "xxx"))
        })
        u.it('return a delta that deletes the text if operation is Disable', () => {
            const s1 = new Segment(1, "xxx", Status.Enabled)
            s1.apply(Operation.Disable)[0].should.deep.equal(new Delta(1, "xxx", ""))
        })
        u.it('update the status of the segment', () => {
            const s1 = new Segment(1, "xxx", Status.Disabled)
            s1.apply(Operation.Enable)[1].should.deep.equal(new Segment(1, "xxx", Status.Enabled))

            const s2 = new Segment(1, "xxx", Status.Enabled)
            s2.apply(Operation.Disable)[1].should.deep.equal(new Segment(1, "xxx", Status.Disabled))
        })
        u.it('return null if the operation has no effect', () => {
            const s1 = new Segment(1, "xxx", Status.Disabled)
            should.not.exist(s1.apply(Operation.Disable))

            const s2 = new Segment(1, "xxx", Status.Enabled)
            should.not.exist(s2.apply(Operation.Enable))
        })
    })
    describe('#split', () => {
        u.it('return the list of the splitted segment', () => {
            const s = new Segment(1, "1234", Status.Enabled)
            s.split([2]).should.deep.equal([new Segment(1, "1", Status.Enabled), new Segment(2, "234", Status.Enabled)])

            s.split([2, 4]).should.deep.equal([
                new Segment(1, "1", Status.Enabled), new Segment(2, "23", Status.Enabled), new Segment(4, "4", Status.Enabled)
            ])
        })
        u.it('ignore invalid offsets', () => {
            const s = new Segment(1, "1234", Status.Enabled)
            s.split([0]).should.deep.equal([s])
            s.split([1]).should.deep.equal([s])
            s.split([5]).should.deep.equal([s])

            s.split([2, 2]).should.deep.equal([new Segment(1, "1", Status.Enabled), new Segment(2, "234", Status.Enabled)])
        })
    })
})
