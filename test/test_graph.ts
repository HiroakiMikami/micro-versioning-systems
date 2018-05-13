import * as chai from 'chai'
const should = chai.should()

import { ExecutionMode, ConstrainedData } from '../src/common'
import { ImmutableDirectedGraph, MutableDirectedGraph } from '../src/graph'

describe('DirectedGraph', () => {
    ConstrainedData.mode = ExecutionMode.Release
    describe('#validate', () => {
        it('edges should connects two vertices in this.vertices', () => {
            const g1 = new ImmutableDirectedGraph<number, string>(new Set([0, 1, 2]), new Map([[0, new Map([[1, ""]])]]))
            should.not.exist(g1.validate())

            const g2 = new ImmutableDirectedGraph<number, string>(new Set([0, 1, 2]), new Map([[3, new Map()]]))
            g2.validate().should.equal("the vertex (3) is not in the vertices set")

            const g3 = new ImmutableDirectedGraph<number, string>(new Set([0, 1, 2]), new Map([[0, new Map([[3, ""]])]]))
            g3.validate().should.equal("the vertex (3) is not in the vertices set")
        })
        it('a graph can have additional constraints', () => {
            const g = new ImmutableDirectedGraph<number, string>(new Set([0]), new Map(), _ => "invalid")
            g.validate().should.equal("invalid")
        })
    })

    ConstrainedData.mode = ExecutionMode.Debug
    describe('#successors', () => {
        it('return the successors of the vertex', () => {
            const g = new ImmutableDirectedGraph<number, string>(
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

describe('MutableDirectedGraph', () => {
    ConstrainedData.mode = ExecutionMode.Debug
    describe('#addVertex', () => {
        it('add a vertex', () => {
            const g = new MutableDirectedGraph(new Set(), new Map())
            g.addVertex(0)
            g.vertices.should.deep.equal(new Set([0]))

            g.addVertex(0)
        })
        it('do nothing if the vertex is already added', () => {
            const g = new MutableDirectedGraph(new Set([0]), new Map())
            g.addVertex(0)
            g.vertices.should.deep.equal(new Set([0]))
        })
    })
    describe('#removeVertex', () => {
        it('remove the vertex', () => {
            const g = new MutableDirectedGraph(new Set([0]), new Map())
            g.removeVertex(0)
            g.vertices.should.deep.equal(new Set())
        })
        it('delete the edges that contain the removed vertex', () => {
            const g = new MutableDirectedGraph(new Set([0, 1, 2]),
                                               new Map([[0, new Map([[1, ""], [2, ""]])], [1, new Map([[0, ""], [2, ""]])]]))
            g.removeVertex(0)
            g.vertices.should.deep.equal(new Set([1, 2]))
            g.edges.should.deep.equal(new Map([[1, new Map([[2, ""]])]]))
        })
        it('do nothing if the vertex set does not contain the vertex', () => {
            const g = new MutableDirectedGraph(new Set([0]), new Map())
            g.removeVertex(1)
            g.vertices.should.deep.equal(new Set([0]))
        })
    })
    describe('#addEdge', () => {
        it('add a edge', () => {
            const g = new MutableDirectedGraph(new Set([0, 1]), new Map())
            g.addEdge(0, 1, "")
            g.edges.should.deep.equal(new Map([[0, new Map([[1, ""]])]]))
        })
        it('do nothing if the edge is already added', () => {
            const g = new MutableDirectedGraph(new Set([0]), new Map([[0, new Map([[1, ""]])]]))
            g.addEdge(0, 1, "")
            g.edges.should.deep.equal(new Map([[0, new Map([[1, ""]])]]))
        })
    })
    describe('#removeEdge', () => {
        it('remove the edge', () => {
            const g = new MutableDirectedGraph(new Set([0, 1, 2]), new Map([[0, new Map([[1, ""], [2, ""]])]]))
            g.removeEdge(0, 1)
            g.edges.should.deep.equal(new Map([[0, new Map([[2, ""]])]]))
            g.removeEdge(0, 2)
            g.edges.should.deep.equal(new Map())
        })
        it('do nothing if the edge set does not contain the edge', () => {
            const g = new MutableDirectedGraph(new Set([0]), new Map())
            g.removeEdge(0, 1)
            g.edges.should.deep.equal(new Map())
        })
    })
    describe('#immutable', () => {
        it('generate ImmutableDirectedGraph', () => {
            const g = new MutableDirectedGraph(new Set([0, 1]), new Map([[0, new Map([[1, ""]])]]));
            (g.immutable() instanceof ImmutableDirectedGraph).should.equal(true)
        })
        it('the returned immutable graph should not be modified when the mutable graph is modified', () => {
            const g = new MutableDirectedGraph(new Set([0, 1]), new Map([[0, new Map([[1, ""]])]]))
            const immutable = g.immutable()
            g.addVertex(2)
            g.addEdge(1, 0, "")
            g.addEdge(0, 2, "")
            immutable.vertices.should.deep.equal(new Set([0, 1]))
            immutable.edges.should.deep.equal(new Map([[0, new Map([[1, ""]])]]))
        })
    })
})
