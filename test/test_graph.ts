import * as chai from 'chai'
chai.should()

import * as u from "./utils"
import { ImmutableDirectedGraph, MutableDirectedGraph, to_mutable, to_immutable } from '../src/graph'

describe('DirectedGraph', () => {
    describe('validation', () => {
        u.it('edges should connects two vertices in this.vertices', () => {
            (() => new ImmutableDirectedGraph<number, string>(new Set([0, 1, 2]), new Map([[0, new Map([[1, ""]])]])))
                .should.not.throw();

            (() => new ImmutableDirectedGraph<number, string>(new Set([0, 1, 2]), new Map([[3, new Map()]])))
                .should.throw();

            (() => new ImmutableDirectedGraph<number, string>(new Set([0, 1, 2]), new Map([[0, new Map([[3, ""]])]])))
                .should.throw()
        })
        u.it('a graph can have additional constraints', () => {
            (() => new ImmutableDirectedGraph<number, string>(new Set([0]), new Map(), _ => "invalid"))
                .should.throw()
        })
    })

    describe('#successors', () => {
        u.it('return the successors of the vertex', () => {
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
    describe('#addVertex', () => {
        u.it('add a vertex', () => {
            const g = new MutableDirectedGraph(new Set(), new Map())
            g.addVertex(0)
            g.vertices.should.deep.equal(new Set([0]))

            g.addVertex(0)
        })
        u.it('do nothing if the vertex is already added', () => {
            const g = new MutableDirectedGraph(new Set([0]), new Map())
            g.addVertex(0)
            g.vertices.should.deep.equal(new Set([0]))
        })
    })
    describe('#removeVertex', () => {
        u.it('remove the vertex', () => {
            const g = new MutableDirectedGraph(new Set([0]), new Map())
            g.removeVertex(0)
            g.vertices.should.deep.equal(new Set())
        })
        u.it('delete the edges that contain the removed vertex', () => {
            const g = new MutableDirectedGraph(new Set([0, 1, 2]),
                                               new Map([[0, new Map([[1, ""], [2, ""]])], [1, new Map([[0, ""], [2, ""]])]]))
            g.removeVertex(0)
            g.vertices.should.deep.equal(new Set([1, 2]))
            g.edges.should.deep.equal(new Map([[1, new Map([[2, ""]])]]))
        })
        u.it('do nothing if the vertex set does not contain the vertex', () => {
            const g = new MutableDirectedGraph(new Set([0]), new Map())
            g.removeVertex(1)
            g.vertices.should.deep.equal(new Set([0]))
        })
    })
    describe('#addEdge', () => {
        u.it('add a edge', () => {
            const g = new MutableDirectedGraph(new Set([0, 1]), new Map())
            g.addEdge(0, 1, "")
            g.edges.should.deep.equal(new Map([[0, new Map([[1, ""]])]]))
        })
        u.it('do nothing if the edge is already added', () => {
            const g = new MutableDirectedGraph(new Set([0, 1]), new Map([[0, new Map([[1, ""]])]]))
            g.addEdge(0, 1, "")
            g.edges.should.deep.equal(new Map([[0, new Map([[1, ""]])]]))
        })
    })
    describe('#removeEdge', () => {
        u.it('remove the edge', () => {
            const g = new MutableDirectedGraph(new Set([0, 1, 2]), new Map([[0, new Map([[1, ""], [2, ""]])]]))
            g.removeEdge(0, 1)
            g.edges.should.deep.equal(new Map([[0, new Map([[2, ""]])]]))
            g.removeEdge(0, 2)
            g.edges.should.deep.equal(new Map())
        })
        u.it('do nothing if the edge set does not contain the edge', () => {
            const g = new MutableDirectedGraph(new Set([0]), new Map())
            g.removeEdge(0, 1)
            g.edges.should.deep.equal(new Map())
        })
    })
})

describe('#to_mutable', () => {
    u.it('the original immutable graph should not be modified when the returned mutable graph is modified', () => {
        const g = new ImmutableDirectedGraph(new Set([0, 1]), new Map([[0, new Map([[1, ""]])]]))
        const mutable = to_mutable(g)
        mutable.addVertex(2)
        mutable.addEdge(1, 0, "")
        mutable.addEdge(0, 2, "")
        g.vertices.should.deep.equal(new Set([0, 1]))
        g.edges.should.deep.equal(new Map([[0, new Map([[1, ""]])]]))
    })
})

describe('#to_immutable', () => {
    u.it('the returned immutable graph should not be modified when the mutable graph is modified', () => {
        const g = new MutableDirectedGraph(new Set([0, 1]), new Map([[0, new Map([[1, ""]])]]))
        const immutable = to_immutable(g)
        g.addVertex(2)
        g.addEdge(1, 0, "")
        g.addEdge(0, 2, "")
        immutable.vertices.should.deep.equal(new Set([0, 1]))
        immutable.edges.should.deep.equal(new Map([[0, new Map([[1, ""]])]]))
    })
})
