/* eslint-disable @typescript-eslint/explicit-function-return-type */
import * as chai from 'chai'
chai.should()

import * as u from "./utils"
import { Status, Operation } from '../src/common'
import { ImmutableDirectedGraph } from '../src/graph'
import { Delta, Diff, DeleteNonExistingText } from '../src/diff'
import { Segment, SegmentHistory } from '../src/segment'
import { Commit, CommitHistory, Relation, Result } from '../src/commit'

describe('Commit', () => {
    describe('validation', () => {
        u.it('invalid if the set of timestamps is empty', () => {
            (() => new Commit([""], [], new Set([new Date()]), Status.Enabled)).should.not.throw();
            (() => new Commit([""], [], new Set(), Status.Enabled)).should.throw();
        })
        u.it('invalid if there are duplicated segments in the commit', () => {
            (() => new Commit(["1"], ["2"], new Set([new Date()]), Status.Enabled)).should.not.throw();
            (() => new Commit(["1"], ["1"], new Set([new Date()]), Status.Enabled)).should.throw();
            (() => new Commit(["1", "1"], ["2"], new Set([new Date()]), Status.Enabled)).should.throw();
        })
        u.it('invalid if there are no segments in the commit', () => {
            (() => new Commit(["1"], ["2"], new Set([new Date()]), Status.Enabled)).should.not.throw();
            (() => new Commit([], [], new Set([new Date()]), Status.Enabled)).should.throw();
        })
    })

    describe('#toggle', () => {
        u.it('disable the deleted segments then enable the inserted segments if status is \'disabled\'', () => {
            const c = new Commit(["1", "2"], ["3", "4"], new Set([new Date()]), Status.Disabled)
            c.toggle().should.deep.equal([[Operation.Disable, "2"], [Operation.Disable, "1"], [Operation.Enable, "4"], [Operation.Enable, "3"]])
        })
        u.it('disable the inserted segments then enable the deleted segments if status is \'enabled\'', () => {
            const c = new Commit(["1", "2"], ["3", "4"], new Set([new Date()]), Status.Enabled)
            c.toggle().should.deep.equal([[Operation.Disable, "4"], [Operation.Disable, "3"], [Operation.Enable, "2"], [Operation.Enable, "1"]])
        })
    })
})

describe('CommitHistory', () => {
    describe('validation', () => {
        u.it('invalid if the segment id in the commit is not found in the segment history', () => {
            (() => {
                new CommitHistory(new SegmentHistory(new Map([["x", new Segment(0, "x", Status.Disabled)]]), new ImmutableDirectedGraph(new Set(), new Map()), ""),
                                  new Map([["", new Commit([], ["x"], new Set([new Date()]), Status.Enabled)]]),
                                  new ImmutableDirectedGraph(new Set(), new Map()))
            }).should.not.throw();
            (() => {
                new CommitHistory(new SegmentHistory(new Map([["", new Segment(0, "x", Status.Disabled)]]), new ImmutableDirectedGraph(new Set(), new Map()), ""),
                                  new Map([["", new Commit([], ["y"], new Set([new Date()]), Status.Enabled)]]),
                                  new ImmutableDirectedGraph(new Set(), new Map()))
            }).should.throw();
        })
        u.it('invalid if the commit in the relation is not found in the commit history', () => {
            (() => {
                new CommitHistory(new SegmentHistory(new Map([["x", new Segment(0, "x", Status.Disabled)]]), new ImmutableDirectedGraph(new Set(), new Map()), ""),
                                  new Map([["", new Commit([], ["x"], new Set([new Date()]), Status.Enabled)]]),
                                  new ImmutableDirectedGraph(new Set(["y"]), new Map()))
            }).should.throw();
        })
        u.it('invalid if the two commits that overlaps deleted segments do not have exclusive relations', () => {
            (() => {
                new CommitHistory(new SegmentHistory(new Map([["x", new Segment(0, "x", Status.Disabled)]]), new ImmutableDirectedGraph(new Set(), new Map()), ""),
                                  new Map([["1", new Commit(["x"], [], new Set([new Date()]), Status.Enabled)],
                                           ["2", new Commit(["x"], [], new Set([new Date()]), Status.Enabled)]]),
                                  new ImmutableDirectedGraph(new Set(["1", "2"]),
                                                             new Map([["1", new Map([["2", Relation.Exclusive]])],
                                                                      ["2", new Map([["1", Relation.Exclusive]])]])))
            }).should.not.throw();
            (() => {
                new CommitHistory(new SegmentHistory(new Map([["x", new Segment(0, "x", Status.Disabled)]]), new ImmutableDirectedGraph(new Set(), new Map()), ""),
                                  new Map([["1", new Commit(["x"], [], new Set([new Date()]), Status.Enabled)],
                                           ["2", new Commit(["x"], [], new Set([new Date()]), Status.Enabled)]]),
                                  new ImmutableDirectedGraph(new Set(["1", "2"]), new Map()))
            }).should.throw();
            (() => {
                new CommitHistory(new SegmentHistory(new Map([["x", new Segment(0, "x", Status.Disabled)]]), new ImmutableDirectedGraph(new Set(), new Map()), ""),
                                  new Map([["1", new Commit(["x"], [], new Set([new Date()]), Status.Enabled)],
                                           ["2", new Commit(["x"], [], new Set([new Date()]), Status.Enabled)]]),
                                  new ImmutableDirectedGraph(new Set(["1", "2"]), new Map([["1", new Map([["2", Relation.Exclusive]])]])))
            }).should.throw();
        })
        u.it('invalid if the two commits that do\'nt overlaps deleted segments do not have exclusive relations', () => {
            (() => {
                new CommitHistory(new SegmentHistory(new Map([["x", new Segment(0, "x", Status.Disabled)]]), new ImmutableDirectedGraph(new Set(), new Map()), ""),
                                  new Map([["1", new Commit(["x"], [], new Set([new Date()]), Status.Enabled)],
                                           ["2", new Commit([], ["x"], new Set([new Date()]), Status.Enabled)]]),
                                  new ImmutableDirectedGraph(new Set(), new Map()))
            }).should.not.throw();
            (() => {
                new CommitHistory(new SegmentHistory(new Map([["x", new Segment(0, "x", Status.Disabled)]]), new ImmutableDirectedGraph(new Set(), new Map()), ""),
                                  new Map([["1", new Commit(["x"], [], new Set([new Date()]), Status.Enabled)],
                                           ["2", new Commit([], ["x"], new Set([new Date()]), Status.Enabled)]]),
                                  new ImmutableDirectedGraph(new Set(["1", "2"]), new Map([["1", new Map([["2", Relation.Exclusive]])]])))
            }).should.not.throw();
        })
        u.it('invalid if the inverse-relation has edges not correspoinng to relation', () => {
            (() => {
                new CommitHistory(new SegmentHistory(new Map([["x", new Segment(0, "x", Status.Disabled)]]), new ImmutableDirectedGraph(new Set(), new Map()), ""),
                                  new Map([["1", new Commit([], ["x"], new Set([new Date()]), Status.Enabled)],
                                           ["2", new Commit([], ["x"], new Set([new Date()]), Status.Enabled)]]),
                                  new ImmutableDirectedGraph(new Set(["1", "2"]), new Map([["1", new Map([["2", Relation.Depend]])]])),
                                  new ImmutableDirectedGraph(new Set(["1", "2"]), new Map([["2", new Map([["1", Relation.Depend]])]]))
                                )
            }).should.not.throw();
            (() => {
                new CommitHistory(new SegmentHistory(new Map([["x", new Segment(0, "x", Status.Disabled)]]), new ImmutableDirectedGraph(new Set(), new Map()), ""),
                                  new Map([["1", new Commit([], ["x"], new Set([new Date()]), Status.Enabled)],
                                           ["2", new Commit([], ["x"], new Set([new Date()]), Status.Enabled)]]),
                                  new ImmutableDirectedGraph(new Set(["1", "2"]), new Map()),
                                  new ImmutableDirectedGraph(new Set(["1", "2"]), new Map([["2", new Map([["1", Relation.Depend]])]]))
                                )
            }).should.throw();
        })
        u.it('invalid if the inverse-relation does not have edges correspoinng to relation', () => {
            (() => {
                new CommitHistory(new SegmentHistory(new Map([["x", new Segment(0, "x", Status.Disabled)]]), new ImmutableDirectedGraph(new Set(), new Map()), ""),
                                  new Map([["1", new Commit([], ["x"], new Set([new Date()]), Status.Enabled)],
                                           ["2", new Commit([], ["x"], new Set([new Date()]), Status.Enabled)]]),
                                  new ImmutableDirectedGraph(new Set(["1", "2"]), new Map([["1", new Map([["2", Relation.Depend]])]])),
                                  new ImmutableDirectedGraph(new Set(["1", "2"]), new Map())
                                )
            }).should.throw();
        })

    })

    describe('#addDependency', () => {
        u.it('add depend relation', () => {
            const h1 = new CommitHistory(new SegmentHistory(new Map([["x", new Segment(0, "x", Status.Disabled)]]), new ImmutableDirectedGraph(new Set(), new Map()), ""),
                              new Map([["1", new Commit(["x"], [], new Set([new Date()]), Status.Enabled)],
                                       ["2", new Commit([], ["x"], new Set([new Date()]), Status.Enabled)]]),
                              new ImmutableDirectedGraph(new Set(), new Map()))
            const h2 = h1.addDependency("1", "2")
            h2.relation.vertices.should.deep.equal(new Set(["1", "2"]))
            h2.relation.successors("1").should.deep.equal(new Map([["2", Relation.Depend]]))
            h2.relation.successors("2").should.deep.equal(new Map([]))
        })
        u.it('do nothing if the two commit has exclusive relation', () => {
            const h1 = new CommitHistory(new SegmentHistory(new Map([["x", new Segment(0, "x", Status.Disabled)]]), new ImmutableDirectedGraph(new Set(), new Map()), ""),
                                         new Map([["1", new Commit(["x"], [], new Set([new Date()]), Status.Enabled)],
                                                  ["2", new Commit(["x"], [], new Set([new Date()]), Status.Enabled)]]),
                                         new ImmutableDirectedGraph(new Set(["1", "2"]),
                                                                    new Map([["1", new Map([["2", Relation.Exclusive]])],
                                                                    ["2", new Map([["1", Relation.Exclusive]])]])))
            const h2 = h1.addDependency("1", "2")
            h2.should.deep.equal(h1)
            h2.relation.vertices.should.deep.equal(new Set(["1", "2"]))
            h2.relation.successors("1").should.deep.equal(new Map([["2", Relation.Exclusive]]))
        })
    })
    describe('#removeDependency', () => {
        u.it('remove depend relation', () => {
            const h1 = new CommitHistory(new SegmentHistory(new Map([["x", new Segment(0, "x", Status.Disabled)]]), new ImmutableDirectedGraph(new Set(), new Map()), ""),
                                         new Map([["1", new Commit(["x"], [], new Set([new Date()]), Status.Enabled)],
                                                  ["2", new Commit([], ["x"], new Set([new Date()]), Status.Enabled)]]),
                                         new ImmutableDirectedGraph(new Set(), new Map()))
            const h2 = h1.addDependency("1", "2")
            const h3 = h2.removeDependency("1", "2")
            h3.relation.vertices.should.deep.equal(new Set(["1", "2"]))
            h3.relation.successors("1").should.deep.equal(new Map([]))
            h3.relation.successors("2").should.deep.equal(new Map([]))
            h3.removeDependency("1", "3")
        })
        u.it('do nothing if the two commit has exclusive relation', () => {
            const h1 = new CommitHistory(new SegmentHistory(new Map([["x", new Segment(0, "x", Status.Disabled)]]), new ImmutableDirectedGraph(new Set(), new Map()), ""),
                                         new Map([["1", new Commit(["x"], [], new Set([new Date()]), Status.Enabled)],
                                                  ["2", new Commit(["x"], [], new Set([new Date()]), Status.Enabled)]]),
                                         new ImmutableDirectedGraph(new Set(["1", "2"]),
                                                                    new Map([["1", new Map([["2", Relation.Exclusive]])],
                                                                    ["2", new Map([["1", Relation.Exclusive]])]])))
            const h2 = h1.removeDependency("1", "2")
            h2.should.deep.equal(h1)
            h2.relation.vertices.should.deep.equal(new Set(["1", "2"]))
            h2.relation.successors("1").should.deep.equal(new Map([["2", Relation.Exclusive]]))
        })
    })
    describe('#updateDate', () => {
        u.it('add the date to the commits', () => {
            const h1 = new CommitHistory(new SegmentHistory(new Map([["x", new Segment(0, "x", Status.Disabled)]]), new ImmutableDirectedGraph(new Set(), new Map()), ""),
                                         new Map([["1", new Commit(["x"], [], new Set([new Date()]), Status.Enabled)],
                                                  ["2", new Commit([], ["x"], new Set([new Date()]), Status.Enabled)]]),
                                         new ImmutableDirectedGraph(new Set(), new Map()))
            const d = new Date()
            const h2 = h1.addDate(d, new Set(["1"]))
            h2.commits.get("1").timestamps.size.should.equal(2)
            h2.commits.get("2").timestamps.size.should.equal(1)
            h2.commits.get("1").timestamps.should.contain(d)
        })
    })

    describe('#apply_diff', () => {
        u.it('create a commit for each delta', () => {
            const h1 = new CommitHistory(new SegmentHistory(new Map(),
                                                            new ImmutableDirectedGraph(new Set(), new Map()), ""),
                                        new Map(),
                                        new ImmutableDirectedGraph(new Set(), new Map()))
            const current = new Date()
            const r2 = h1.applyDiff(current, new Diff([new Delta(0, "", "xxx")])) as Result
            r2.diff.should.deep.equal(new Diff([new Delta(0, "", "xxx")]))
            r2.newHistory.commits.size.should.equal(1)
            r2.newHistory.history.text.should.equal("xxx")
            r2.newCommits.should.deep.equal(new Set(r2.newHistory.commits.keys()))

            const r3 = r2.newHistory.applyDiff(current,
                                                new Diff([new Delta(3, "", "yyy")])) as Result
            r3.diff.should.deep.equal(new Diff([new  Delta(3, "", "yyy")]))
            r3.newHistory.commits.size.should.equal(2)
            r3.newHistory.history.text.should.equal("xxxyyy")
            r3.newCommits.size.should.equal(1)
            r3.newHistory.relation.edges.size.should.equal(0)
        })
        u.it('update commits if the segments in the commit are splitted', () => {
            const h1 = new CommitHistory(new SegmentHistory(new Map(),
                                                            new ImmutableDirectedGraph(new Set(), new Map()), ""),
                                        new Map(),
                                        new ImmutableDirectedGraph(new Set(), new Map()))
            const current = new Date()
            const r2 = h1.applyDiff(current, new Diff([new Delta(0, "", "xxx")])) as Result
            const c1 = Array.from(r2.newCommits)[0]
            const r3 = r2.newHistory.applyDiff(current,
                                                new Diff([new Delta(2, "x", "")])) as Result
            r3.diff.should.deep.equal(new Diff([new  Delta(2, "x", "")]))
            r3.newHistory.commits.size.should.equal(2)
            r3.newHistory.commits.get(c1).insert.length.should.equal(2)
            r3.newHistory.history.text.should.equal("xx")
            r3.newCommits.size.should.equal(1)
        })
        u.it('add dependency if there is a regional conflict', () => {
            const h1 = new CommitHistory(new SegmentHistory(new Map(),
                                                            new ImmutableDirectedGraph(new Set(), new Map()), ""),
                                        new Map(),
                                        new ImmutableDirectedGraph(new Set(), new Map()))
            const current = new Date()
            const r2 = h1.applyDiff(current, new Diff([new Delta(0, "", "xxx")])) as Result
            const c1 = Array.from(r2.newCommits)[0]
            const r3 = r2.newHistory.applyDiff(current,
                                                new Diff([new Delta(2, "x", "1")])) as Result
            r3.newHistory.history.text.should.equal("xx1")
            r3.newHistory.commits.size.should.equal(2)
            r3.newHistory.commits.get(c1).insert.length.should.equal(2)
            r3.newCommits.size.should.equal(1)
            const c2 = Array.from(r3.newCommits)[0]
            r3.newHistory.relation.successors(c1).get(c2).should.equal(Relation.Depend)
        })
        u.it('add dependency if two commits are created at the same time', () => {
            const h1 = new CommitHistory(new SegmentHistory(new Map(),
                                                            new ImmutableDirectedGraph(new Set(), new Map()), "1"),
                                        new Map(),
                                        new ImmutableDirectedGraph(new Set(), new Map()))
            const current = new Date()
            const r2 = h1.applyDiff(current, new Diff([new Delta(0, "", "xxx"), new Delta(1, "", "yyy")])) as Result
            const c1 = Array.from(r2.newCommits)[0]
            const c2 = Array.from(r2.newCommits)[1]
            r2.newHistory.history.text.should.equal("xxx1yyy")
            r2.newHistory.commits.size.should.equal(2)
            r2.newCommits.size.should.equal(2)
            r2.newHistory.relation.successors(c1).get(c2).should.equal(Relation.Depend)
            r2.newHistory.relation.successors(c2).get(c1).should.equal(Relation.Depend)
        })
        u.it('add exclusive relation if two commits delete the same segment', () => {
            const h1 = new CommitHistory(new SegmentHistory(new Map([["x", new Segment(0, "x", Status.Enabled)]]),
                                                            new ImmutableDirectedGraph(new Set(), new Map()),
                                                            "x"),
                                        new Map([["x", new Commit(["x"], [], new Set([new Date()]), Status.Disabled)]]),
                                        new ImmutableDirectedGraph(new Set(), new Map()))
            const current = new Date()
            const r2 = h1.applyDiff(current, new Diff([new Delta(0, "x", "y")])) as Result
            const c1 = Array.from(r2.newCommits)[0]
            r2.newHistory.history.text.should.equal("y")
            r2.newHistory.commits.size.should.equal(2)
            r2.newCommits.size.should.equal(1)
            r2.newHistory.relation.successors(c1).get("x").should.equal(Relation.Exclusive)
            r2.newHistory.relation.successors("x").get(c1).should.equal(Relation.Exclusive)
        })
        u.it('return conflict if the diff is invalid', () => {
            const h1 = new CommitHistory(new SegmentHistory(new Map(),
                                                            new ImmutableDirectedGraph(new Set(), new Map()), "1"),
                                        new Map(),
                                        new ImmutableDirectedGraph(new Set(), new Map()))
            const current = new Date()
            const r2 = h1.applyDiff(current, new Diff([new Delta(0, "xxx", "")]));
            (r2 instanceof DeleteNonExistingText).should.true
        })
    })

    describe('#toggle', () => {
        u.it('toggle a commit', () => {
            const h1 = new CommitHistory(new SegmentHistory(new Map(),
                                                            new ImmutableDirectedGraph(new Set(), new Map()), ""),
                                        new Map(),
                                        new ImmutableDirectedGraph(new Set(), new Map()))
            const current = new Date()
            const r2 = h1.applyDiff(current, new Diff([new Delta(0, "", "xxx")])) as Result
            const c = Array.from(r2.newCommits)[0]
            const r3 = r2.newHistory.toggle(c) as Result
            r3.diff.should.deep.equal(new Diff([new Delta(0, "xxx", "")]))
            r3.newCommits.size.should.equal(0)
            r3.newHistory.history.text.should.equal("")
            r3.newHistory.commits.get(c).status.should.equal(Status.Disabled)
        })
        u.it('disable depended commits', () => {
            const h1 = new CommitHistory(new SegmentHistory(new Map(),
                                                            new ImmutableDirectedGraph(new Set(), new Map()), ""),
                                        new Map(),
                                        new ImmutableDirectedGraph(new Set(), new Map()))
            const current = new Date()
            const r2 = h1.applyDiff(current, new Diff([new Delta(0, "", "xxx")])) as Result
            const c1 = Array.from(r2.newCommits)[0]
            const r3 = r2.newHistory.applyDiff(current, new Diff([new Delta(1, "", "yyy")])) as Result
            const c2 = Array.from(r3.newCommits)[0]

            const r4 = r3.newHistory.toggle(c2) as Result
            r4.diff.should.deep.equal(new Diff([new Delta(1, "yyy", "")]))
            r4.newCommits.size.should.equal(0)
            r4.newHistory.history.text.should.equal("xxx")
            r4.newHistory.commits.get(c1).status.should.equal(Status.Enabled)
            r4.newHistory.commits.get(c2).status.should.equal(Status.Disabled)

            const r5 = r3.newHistory.toggle(c1) as Result
            r5.diff.should.deep.equal(new Diff([new Delta(0, "xyyyxx", "")]))
            r5.newCommits.size.should.equal(0)
            r5.newHistory.history.text.should.equal("")
            r5.newHistory.commits.get(c1).status.should.equal(Status.Disabled)
            r5.newHistory.commits.get(c2).status.should.equal(Status.Disabled)
        })
        u.it('enable depending commits', () => {
            const h1 = new CommitHistory(new SegmentHistory(new Map(),
                                                            new ImmutableDirectedGraph(new Set(), new Map()), ""),
                                        new Map(),
                                        new ImmutableDirectedGraph(new Set(), new Map()))
            const current = new Date()
            const r2 = h1.applyDiff(current, new Diff([new Delta(0, "", "xxx")])) as Result
            const c1 = Array.from(r2.newCommits)[0]
            const r3 = r2.newHistory.applyDiff(current, new Diff([new Delta(1, "", "yyy")])) as Result
            const c2 = Array.from(r3.newCommits)[0]

            const r4 = r3.newHistory.toggle(c1) as Result

            const r5 = r4.newHistory.toggle(c1) as Result
            r5.diff.should.deep.equal(new Diff([new Delta(0, "", "xxx")]))
            r5.newCommits.size.should.equal(0)
            r5.newHistory.history.text.should.equal("xxx")
            r5.newHistory.commits.get(c1).status.should.equal(Status.Enabled)
            r5.newHistory.commits.get(c2).status.should.equal(Status.Disabled)

            const r6 = r4.newHistory.toggle(c2) as Result
            r6.diff.should.deep.equal(new Diff([new Delta(0, "", "xyyyxx")]))
            r6.newCommits.size.should.equal(0)
            r6.newHistory.history.text.should.equal("xyyyxx")
            r6.newHistory.commits.get(c1).status.should.equal(Status.Enabled)
            r6.newHistory.commits.get(c2).status.should.equal(Status.Enabled)
        })
        u.it('disable exclusive commits', () => {
            const h1 = new CommitHistory(new SegmentHistory(new Map(),
                                                            new ImmutableDirectedGraph(new Set(), new Map()), "xxx"),
                                        new Map(),
                                        new ImmutableDirectedGraph(new Set(), new Map()))
            const current = new Date()
            const r2 = h1.applyDiff(current, new Diff([new Delta(0, "xxx", "111")])) as Result
            const c1 = Array.from(r2.newCommits)[0]
            const r3 = r2.newHistory.toggle(c1) as Result
            const r4 = r3.newHistory.applyDiff(current, new Diff([new Delta(0, "xxx", "222")])) as Result
            const c2 = Array.from(r4.newCommits)[0]

            const r5 = r4.newHistory.toggle(c1) as Result
            r5.diff.should.deep.equal(new Diff([new Delta(0, "222", "111")]))
            r5.newCommits.size.should.equal(0)
            r5.newHistory.history.text.should.equal("111")
            r5.newHistory.commits.get(c1).status.should.equal(Status.Enabled)
            r5.newHistory.commits.get(c2).status.should.equal(Status.Disabled)

            const r6 = r5.newHistory.toggle(c2) as Result
            r6.diff.should.deep.equal(new Diff([new Delta(0, "111", "222")]))
            r6.newCommits.size.should.equal(0)
            r6.newHistory.history.text.should.equal("222")
            r6.newHistory.commits.get(c1).status.should.equal(Status.Disabled)
            r6.newHistory.commits.get(c2).status.should.equal(Status.Enabled)
        })
    })
})
