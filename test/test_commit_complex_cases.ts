/* eslint-disable @typescript-eslint/explicit-function-return-type */
import * as chai from 'chai'
chai.should()

import * as u from "./utils"
import { Delta, Diff } from '../src/diff'
import { ImmutableDirectedGraph } from '../src/graph'
import { SegmentHistory } from '../src/segment'
import { CommitHistory, Result } from '../src/commit'

describe('CommitHistory (Complex Cases)', () => {
    u.it('case 1 (regional redo/redo propagation)', () => {
        const h1 = new CommitHistory(
            new SegmentHistory(new Map(), new ImmutableDirectedGraph(new Set(), new Map()), ""),
            new Map(),
            new ImmutableDirectedGraph(new Set(), new Map()))
        const r2 = h1.applyDiff(new Date(), new Diff([new Delta(0, "", "f();")])) as Result
        r2.newHistory.history.text.should.equal("f();")
        const c1 = Array.from(r2.newCommits)[0]
        const r3 = r2.newHistory.applyDiff(new Date(), new Diff([new Delta(2, "", "10")])) as Result
        r3.newHistory.history.text.should.equal("f(10);")
        const c2 = Array.from(r3.newCommits)[0]

        const r4 = r3.newHistory.toggle(c1) as Result
        r4.newHistory.history.text.should.equal("")

        {
            const r5 = r4.newHistory.toggle(c2) as Result
            r5.newHistory.history.text.should.equal("f(10);")
        }
        {
            const r5 = r4.newHistory.toggle(c1) as Result
            r5.newHistory.history.text.should.equal("f();")
        }
    })
    u.it('case 2 (exclusive edits)', () => {
        const h1 = new CommitHistory(
            new SegmentHistory(new Map(), new ImmutableDirectedGraph(new Set(), new Map()), ""),
            new Map(),
            new ImmutableDirectedGraph(new Set(), new Map()))
        const r2 = h1.applyDiff(new Date(), new Diff([new Delta(0, "", "x = 1.0;")])) as Result
        r2.newHistory.history.text.should.equal("x = 1.0;")
        const r3 = r2.newHistory.applyDiff(new Date(), new Diff([new Delta(4, "1.0", "2.0")])) as Result
        r3.newHistory.history.text.should.equal("x = 2.0;")
        const c2 = Array.from(r3.newCommits)[0]

        const r4 = r3.newHistory.toggle(c2) as Result
        r4.newHistory.history.text.should.equal("x = 1.0;")

        const r5 = r4.newHistory.applyDiff(new Date(), new Diff([new Delta(4, "1.0", "3.0")])) as Result
        r5.newHistory.history.text.should.equal("x = 3.0;")

        const r6 = r5.newHistory.toggle(c2) as Result
        r6.newHistory.history.text.should.equal("x = 2.0;")
    })
    u.it('case 3 (grouping separated edits)', () => {
        const h1 = new CommitHistory(
            new SegmentHistory(new Map(), new ImmutableDirectedGraph(new Set(), new Map()), "\n"),
            new Map(),
            new ImmutableDirectedGraph(new Set(), new Map()))
        const r2 = h1.applyDiff(
            new Date(),
            new Diff([new Delta(0, "", "x = 10;"), new Delta(1, "", "print(x);")])) as Result
        r2.newHistory.history.text.should.equal("x = 10;\nprint(x);")
        const c1 = Array.from(r2.newCommits)[0]

        const r3 = r2.newHistory.toggle(c1) as Result
        r3.newHistory.history.text.should.equal("\n")
    })
})
