import * as chai from 'chai'
const should = chai.should()

import { ExecutionMode, ConstrainedData } from '../src/common'
import { DirectedGraph } from '../src/graph'

describe('DirectedGraph', () => {
    ConstrainedData.mode = ExecutionMode.Release
    describe('#validate', () => {
        it('edges should connects two vertices in this.vertices', () => {
            const g1 = new DirectedGraph<number, string>(new Set([0, 1, 2]), new Map([[0, new Map([[1, ""]])]]))
            should.not.exist(g1.validate())

            const g2 = new DirectedGraph<number, string>(new Set([0, 1, 2]), new Map([[3, new Map()]]))
            g2.validate().should.equal("the vertex (3) is not in the vertices set")

            const g3 = new DirectedGraph<number, string>(new Set([0, 1, 2]), new Map([[0, new Map([[3, ""]])]]))
            g3.validate().should.equal("the vertex (3) is not in the vertices set")
        })
        it('a graph can have additional constraints', () => {
            const g = new DirectedGraph<number, string>(new Set([0]), new Map(), _ => "invalid")
            g.validate().should.equal("invalid")
        })
    })

    ConstrainedData.mode = ExecutionMode.Debug
    describe('#successors', () => {
        it('return the successors of the vertex', () => {
            const g = new DirectedGraph<number, string>(
                new Set([0, 1, 2]),
                new Map([
                    [0, new Map([[1, "1"], [2, "2"]])],
                    [2, new Map([[1, "1"]])]
                ])
            )
            g.successors(0).should.deep.equal(new Map([[1, "1"], [2, "2"]]))
            g.successors(1).should.deep.equal(new Map())
            g.successors(2).should.deep.equal(new Map([[1, "1"]]))
        })
    })
})
