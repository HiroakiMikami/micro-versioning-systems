/* eslint-disable @typescript-eslint/explicit-function-return-type */
import * as chai from 'chai'
chai.should()

import { Commit } from '../src/commit'
import { evaluate } from '../src/score'
import { Status } from '../src/common'

describe('#evaluate', () => {
    it('calculate scores using the set of timestamps', () => {
        const d1 = new Date(0)
        const d2 = new Date(1)
        const d3 = new Date(2)

        const commit1 = new Commit(["x"], [], new Set([d1]), Status.Enabled)
        const commit2 = new Commit(["x"], [], new Set([d2, d3]), Status.Enabled)

        const results = evaluate(new Map([["1", commit1], ["2", commit2]]))
        results.size.should.equal(2)
        results.get("1").should.be.closeTo(1 / (1 * Math.exp(12)), 0.001)
        results.get("2").should.be.closeTo(1 / (1 + Math.exp(0)) + 1 / (1 + Math.exp(6)), 0.001)

        const results2 = evaluate(new Map([["1", commit1]]))
        results2.size.should.equal(1)
        results2.get("1").should.be.closeTo(1 / (1 * Math.exp(12)), 0.001)
    })
})
