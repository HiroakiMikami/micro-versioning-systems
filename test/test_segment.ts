import * as chai from 'chai'
const should = chai.should()

import * as u from "./utils"
import { Interval } from '../src/common'
import { Delta, Diff, DeleteNonExistingText } from '../src/diff'
import { ImmutableDirectedGraph } from '../src/graph'
import { Segment, SegmentHistory, Status, Operation, ApplyResult } from '../src/segment'

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
describe('SegmentHistory', () => {
    describe('validation', () => {
        u.it('invalid if the enabled segment is not in the text', () => {
            (() => new SegmentHistory(new Map([["", new Segment(0, "xxx", Status.Enabled)]]),
                                     new ImmutableDirectedGraph(new Set(), new Map()), "xxx")).should.not.throw();
            (() => new SegmentHistory(new Map([["", new Segment(0, "xxx", Status.Enabled)]]),
                                      new ImmutableDirectedGraph(new Set(), new Map()), "xxxyyy")).should.not.throw();
            (() => new SegmentHistory(new Map([["", new Segment(0, "xxx", Status.Disabled)]]),
                                      new ImmutableDirectedGraph(new Set(), new Map()), "yyyxxx")).should.not.throw();
            (() => new SegmentHistory(new Map([["", new Segment(0, "xxx", Status.Enabled)]]),
                                      new ImmutableDirectedGraph(new Set(), new Map()), "yyyxxx")).should.throw();
            (() => new SegmentHistory(new Map([["", new Segment(0, "xxx", Status.Enabled)]]),
                                      new ImmutableDirectedGraph(new Set(), new Map()), "x")).should.throw()
        })
        u.it('invalid if the enabled segments are overlapped', () => {
            (() => new SegmentHistory(new Map([["0", new Segment(0, "xx", Status.Enabled)], ["2", new Segment(1, "xx", Status.Enabled)]]),
                                      new ImmutableDirectedGraph(new Set(), new Map()), "xxxx")).should.throw();
            (() => new SegmentHistory(new Map([["0", new Segment(0, "xxx", Status.Enabled)], ["1", new Segment(1, "xxx", Status.Enabled)]]),
                                      new ImmutableDirectedGraph(new Set(), new Map()), "xxxx")).should.throw()
        })
        u.it('invalid if the enabled segment is closed', () => {
            (() => new SegmentHistory(new Map([["0", new Segment(0, "xxx", Status.Disabled)]]),
                                      new ImmutableDirectedGraph(new Set(["0"]), new Map()), "xxxx")).should.not.throw();
            (() => new SegmentHistory(new Map([["0", new Segment(0, "xxx", Status.Enabled)]]),
                                      new ImmutableDirectedGraph(new Set(["0"]), new Map()), "xxxx")).should.throw()
        })
        u.it('invalid if the closing graph has non-existing segment', () => {
            (() => new SegmentHistory(new Map([["0", new Segment(0, "xxx", Status.Disabled)]]),
                                      new ImmutableDirectedGraph(new Set(["0"]), new Map()), "xxxx")).should.not.throw();
            (() => new SegmentHistory(new Map(),
                                      new ImmutableDirectedGraph(new Set(["0"]), new Map()), "xxxx")).should.throw()
        })
    })
    describe('#apply_diff', () => {
        u.it('insert text and update segments', () => {
            const h = new SegmentHistory(new Map(), new ImmutableDirectedGraph(new Set(), new Map()), "")
            const r2 = h.apply_diff(new Diff([new Delta(0, "", "xxx")])) as ApplyResult
            r2.newHistory.text.should.equal("xxx")
            r2.insert.length.should.equal(1)
            r2.remove.length.should.equal(0)
            r2.diff.should.deep.equal(new Diff([new Delta(0, "", "xxx")]))
            Array.from(r2.newHistory.segments.values()).should.deep.equal([new Segment(0, "xxx", Status.Enabled)])

            {
                const r = r2.newHistory.apply_diff(new Diff([new Delta(1, "", "yyy")])) as ApplyResult
                r.splittedSegments.has(r2.insert[0]).should.true
                r.insert.length.should.equal(1)
                r.newHistory.segments.get(r.insert[0]).should.deep.equal(new Segment(1, "yyy", Status.Enabled))
                r.remove.length.should.equal(0)
                r.newHistory.text.should.equal("xyyyxx")
                r.diff.should.deep.equal(new Diff([new Delta(1, "", "yyy")]))
                Array.from(r.newHistory.segments.values()).should.deep.equal([new Segment(0, "x", Status.Enabled),
                                                                              new Segment(4, "xx", Status.Enabled),
                                                                              new Segment(1, "yyy", Status.Enabled)])
            }

            {
                const r = r2.newHistory.apply_diff(new Diff([new Delta(0, "", "yyy")])) as ApplyResult
                r.splittedSegments.size.should.equal(0)
                r.insert.length.should.equal(1)
                r.newHistory.segments.get(r.insert[0]).should.deep.equal(new Segment(0, "yyy", Status.Enabled))
                r.remove.length.should.equal(0)
                r.newHistory.text.should.equal("yyyxxx")
                r.diff.should.deep.equal(new Diff([new Delta(0, "", "yyy")]))
                Array.from(r.newHistory.segments.values()).should.deep.equal([new Segment(3, "xxx", Status.Enabled),
                                                                              new Segment(0, "yyy", Status.Enabled)])
            }

            {
                const r = r2.newHistory.apply_diff(new Diff([new Delta(3, "", "yyy")])) as ApplyResult
                r.splittedSegments.size.should.equal(0)
                r.insert.length.should.equal(1)
                r.newHistory.segments.get(r.insert[0]).should.deep.equal(new Segment(3, "yyy", Status.Enabled))
                r.remove.length.should.equal(0)
                r.newHistory.text.should.equal("xxxyyy")
                r.diff.should.deep.equal(new Diff([new Delta(3, "", "yyy")]))
                Array.from(r.newHistory.segments.values()).should.deep.equal([new Segment(0, "xxx", Status.Enabled),
                                                                              new Segment(3, "yyy", Status.Enabled)])
            }
        })
        u.it('delete text and update segments', () => {
            {
                const h1 = new SegmentHistory(new Map(), new ImmutableDirectedGraph(new Set(), new Map()), "123456")
                const r2 = h1.apply_diff(new Diff([new Delta(6, "", "xxx")])) as ApplyResult
                const r3 = r2.newHistory.apply_diff(new Diff([new Delta(1, "234", "")])) as ApplyResult
                r3.newHistory.text.should.equal("156xxx")
                r3.insert.length.should.equal(0)
                r3.remove.length.should.equal(1)
                r3.newHistory.segments.get(r3.remove[0]).should.deep.equal(new Segment(1, "234", Status.Disabled))
                r3.diff.should.deep.equal(new Diff([new Delta(1, "234", "")]))
                Array.from(r3.newHistory.segments.values()).should.deep.equal([new Segment(3, "xxx", Status.Enabled), new Segment(1, "234", Status.Disabled)])
            }
            {
                const h1 = new SegmentHistory(new Map(), new ImmutableDirectedGraph(new Set(), new Map()), "xxx")
                const h2 = (h1.apply_diff(new Diff([new Delta(3, "", "123456")])) as ApplyResult).newHistory
                const r3 = h2.apply_diff(new Diff([new Delta(2, "x12", "")])) as ApplyResult
                r3.newHistory.text.should.equal("xx3456")
                r3.splittedSegments.size.should.equal(1)
                r3.insert.length.should.equal(0)
                r3.remove.length.should.equal(2)
                r3.newHistory.segments.get(r3.remove[0]).should.deep.equal(new Segment(2, "x", Status.Disabled))
                r3.newHistory.segments.get(r3.remove[1]).should.deep.equal(new Segment(2, "12", Status.Disabled))
                r3.diff.should.deep.equal(new Diff([new Delta(2, "x12", "")]))
                Array.from(r3.newHistory.segments.values()).should.deep.equal([new Segment(2, "12", Status.Disabled),
                                                                               new Segment(2, "3456", Status.Enabled),
                                                                               new Segment(2, "x", Status.Disabled)])
            }
            {
                const h1 = new SegmentHistory(new Map(), new ImmutableDirectedGraph(new Set(), new Map()), "xxx")
                const h2 = (h1.apply_diff(new Diff([new Delta(0, "", "123456")])) as ApplyResult).newHistory
                const r3 = h2.apply_diff(new Diff([new Delta(4, "56x", "")])) as ApplyResult
                r3.newHistory.text.should.equal("1234xx")
                r3.splittedSegments.size.should.equal(1)
                r3.insert.length.should.equal(0)
                r3.remove.length.should.equal(2)
                r3.newHistory.segments.get(r3.remove[0]).should.deep.equal(new Segment(4, "56", Status.Disabled))
                r3.newHistory.segments.get(r3.remove[1]).should.deep.equal(new Segment(4, "x", Status.Disabled))
                r3.diff.should.deep.equal(new Diff([new Delta(4, "56x", "")]))
                Array.from(r3.newHistory.segments.values()).should.deep.equal([new Segment(0, "1234", Status.Enabled),
                                                                               new Segment(4, "56", Status.Disabled),
                                                                               new Segment(4, "x", Status.Disabled)])
            }
            {
                const h1 = new SegmentHistory(new Map(), new ImmutableDirectedGraph(new Set(), new Map()), "")
                const h2 = (h1.apply_diff(new Diff([new Delta(0, "", "123456")])) as ApplyResult).newHistory
                const r3 = h2.apply_diff(new Diff([new Delta(1, "234", "")])) as ApplyResult
                r3.newHistory.text.should.equal("156")
                r3.splittedSegments.size.should.equal(1)
                r3.insert.length.should.equal(0)
                r3.remove.length.should.equal(1)
                r3.newHistory.segments.get(r3.remove[0]).should.deep.equal(new Segment(1, "234", Status.Disabled))
                r3.diff.should.deep.equal(new Diff([new Delta(1, "234", "")]))
                Array.from(r3.newHistory.segments.values()).should.deep.equal([new Segment(0, "1", Status.Enabled),
                                                                               new Segment(1, "234", Status.Disabled),
                                                                               new Segment(1, "56", Status.Enabled)])
            }
            {
                const h1 = new SegmentHistory(new Map(), new ImmutableDirectedGraph(new Set(), new Map()), "xxxx")
                const h2 = (h1.apply_diff(new Diff([new Delta(2, "", "123")])) as ApplyResult).newHistory
                const r3 = h2.apply_diff(new Diff([new Delta(1, "x123x", "")])) as ApplyResult
                r3.newHistory.text.should.equal("xx")
                r3.splittedSegments.size.should.equal(0)
                r3.insert.length.should.equal(0)
                r3.remove.length.should.equal(3)
                r3.newHistory.segments.get(r3.remove[0]).should.deep.equal(new Segment(1, "x", Status.Disabled))
                r3.newHistory.segments.get(r3.remove[1]).should.deep.equal(new Segment(1, "123", Status.Disabled))
                r3.newHistory.segments.get(r3.remove[2]).should.deep.equal(new Segment(1, "x", Status.Disabled))
                r3.diff.should.deep.equal(new Diff([new Delta(1, "x123x", "")]))
                Array.from(r3.newHistory.segments.values()).should.deep.equal([new Segment(1, "123", Status.Disabled),
                                                                               new Segment(1, "x", Status.Disabled),
                                                                               new Segment(1, "x", Status.Disabled)])
            }
            {
                const h1 = new SegmentHistory(new Map(), new ImmutableDirectedGraph(new Set(), new Map()), "xxxx123")
                const h2 = (h1.apply_diff(new Diff([new Delta(4, "123", "")])) as ApplyResult).newHistory
                const r3 = h2.apply_diff(new Diff([new Delta(0, "xx", "")])) as ApplyResult
                r3.newHistory.text.should.equal("xx")
                r3.splittedSegments.size.should.equal(0)
                r3.insert.length.should.equal(0)
                r3.remove.length.should.equal(1)
                r3.newHistory.segments.get(r3.remove[0]).should.deep.equal(new Segment(0, "xx", Status.Disabled))
                r3.diff.should.deep.equal(new Diff([new Delta(0, "xx", "")]))
                Array.from(r3.newHistory.segments.values()).should.deep.equal([new Segment(2, "123", Status.Disabled),
                                                                               new Segment(0, "xx", Status.Disabled)])
            }
        })
        u.it('replace text and update segments', () => {
            {
                const h1 = new SegmentHistory(new Map(), new ImmutableDirectedGraph(new Set(), new Map()), "123456")
                const r2 = h1.apply_diff(new Diff([new Delta(1, "234", "xxx")])) as ApplyResult
                r2.newHistory.text.should.equal("1xxx56")
                r2.insert.length.should.equal(1)
                r2.newHistory.segments.get(r2.insert[0]).should.deep.equal(new Segment(1, "xxx", Status.Enabled))
                r2.remove.length.should.equal(1)
                r2.newHistory.segments.get(r2.remove[0]).should.deep.equal(new Segment(1, "234", Status.Disabled))
                r2.diff.should.deep.equal(new Diff([new Delta(1, "234", "xxx")]))
                Array.from(r2.newHistory.segments.values()).should.deep.equal([new Segment(1, "234", Status.Disabled), new Segment(1, "xxx", Status.Enabled)])
            }
        })
        u.it('close text segments', () => {
            {
                const h1 = new SegmentHistory(new Map(), new ImmutableDirectedGraph(new Set(), new Map()), "")
                const h2 = (h1.apply_diff(new Diff([new Delta(0, "", "12")])) as ApplyResult).newHistory
                const h3 = (h2.apply_diff(new Diff([new Delta(2, "", "34")])) as ApplyResult).newHistory
                const h4 = (h3.apply_diff(new Diff([new Delta(4, "", "5678")])) as ApplyResult).newHistory
                const r5 = h4.apply_diff(new Diff([new Delta(3, "45", "")])) as ApplyResult
                const closed1 = r5.remove
                const r6 = r5.newHistory.apply_diff(new Diff([new Delta(1, "2367", "")])) as ApplyResult
                r6.newHistory.text.should.equal("18")
                r6.insert.length.should.equal(0)
                r6.remove.length.should.equal(3)
                r6.newHistory.segments.get(r6.remove[0]).should.deep.equal(new Segment(1, "2", Status.Disabled))
                r6.newHistory.segments.get(r6.remove[1]).should.deep.equal(new Segment(1, "3", Status.Disabled))
                r6.newHistory.segments.get(r6.remove[2]).should.deep.equal(new Segment(1, "67", Status.Disabled))
                Array.from(r6.newHistory.segments.values()).should.deep.equal([new Segment(1, "3", Status.Disabled),
                                                                               new Segment(1, "4", Status.Disabled),
                                                                               new Segment(1, "5", Status.Disabled),
                                                                               new Segment(0, "1", Status.Enabled),
                                                                               new Segment(1, "2", Status.Disabled),
                                                                               new Segment(1, "67", Status.Disabled),
                                                                               new Segment(1, "8", Status.Enabled)])
                const closed2 = r6.remove[2]
                const s2 = r6.newHistory.closing.successors(closed2)
                s2.size.should.equal(2)
                Array.from(s2.keys()).should.deep.equal(closed1)
                for (const s of Array.from(s2)) {
                    s[1].should.equal(0)
                }
            }
        })
        u.it('apply multiple delta', () => {
            {
                const h1 = new SegmentHistory(new Map(), new ImmutableDirectedGraph(new Set(), new Map()), "")
                const h2 = (h1.apply_diff(new Diff([new Delta(0, "", "123456")])) as ApplyResult).newHistory
                const r3 = h2.apply_diff(new Diff([new Delta(1, "23", ""), new Delta(4, "5", "xx"), new Delta(6, "", "yy")])) as ApplyResult
                r3.newHistory.text.should.equal("14xx6yy")
                r3.insert.length.should.equal(2)
                r3.newHistory.segments.get(r3.insert[0]).should.deep.equal(new Segment(2, "xx", Status.Enabled))
                r3.newHistory.segments.get(r3.insert[1]).should.deep.equal(new Segment(5, "yy", Status.Enabled))
                r3.remove.length.should.equal(2)
                r3.newHistory.segments.get(r3.remove[0]).should.deep.equal(new Segment(1, "23", Status.Disabled))
                r3.newHistory.segments.get(r3.remove[1]).should.deep.equal(new Segment(2, "5", Status.Disabled))
                r3.diff.should.deep.equal(new Diff([new Delta(1, "23", ""), new Delta(4, "5", "xx"), new Delta(6, "", "yy")]))
                Array.from(r3.newHistory.segments.values()).should.deep.equal([new Segment(5, "yy", Status.Enabled),
                                                                               new Segment(2, "5", Status.Disabled),
                                                                               new Segment(4, "6", Status.Enabled),
                                                                               new Segment(2, "xx", Status.Enabled),
                                                                               new Segment(0, "1", Status.Enabled),
                                                                               new Segment(1, "23", Status.Disabled),
                                                                               new Segment(1, "4", Status.Enabled)])
            }
        })
        u.it('return conflict if the diff is impossible', () => {
            const h1 = new SegmentHistory(new Map(), new ImmutableDirectedGraph(new Set(), new Map()), "123")
            const r2 = h1.apply_diff(new Diff([new Delta(0, "abc", "")]))
            r2.should.deep.equal(new DeleteNonExistingText(0, "abc", "123"))
        })
    })
    describe('#apply_operations', () => {
        u.it('enable and disable the segment', () => {
            const h1 = new SegmentHistory(new Map(), new ImmutableDirectedGraph(new Set(), new Map()), "123")
            const r2 = h1.apply_diff(new Diff([new Delta(0, "123", "456")])) as ApplyResult
            const r3 = r2.newHistory.apply_operations([[Operation.Disable, r2.insert[0]]]) as ApplyResult
            r3.insert.length.should.equal(0)
            r3.remove.length.should.equal(1)
            r3.remove[0].should.equal(r2.insert[0])
            r3.newHistory.text.should.equal("")
            r3.diff.should.deep.equal(new Diff([new Delta(0, "456", "")]))
            Array.from(r3.newHistory.segments.values()).should.deep.equal([new Segment(0, "123", Status.Disabled), new Segment(0, "456", Status.Disabled)])

            const r4 = r2.newHistory.apply_operations([[Operation.Enable, r2.remove[0]]]) as ApplyResult
            r4.insert.length.should.equal(1)
            r4.insert[0].should.equal(r2.remove[0])
            r4.remove.length.should.equal(0)
            r4.newHistory.text.should.equal("123456")
            r4.diff.should.deep.equal(new Diff([new Delta(0, "", "123")]))
            Array.from(r4.newHistory.segments.values()).should.deep.equal([new Segment(0, "123", Status.Enabled), new Segment(3, "456", Status.Enabled)])
        })
        u.it('reopen the closed segment', () => {
            const h1 = new SegmentHistory(new Map(), new ImmutableDirectedGraph(new Set(), new Map()), "123")
            const r2 = h1.apply_diff(new Diff([new Delta(1, "2", "")])) as ApplyResult
            const r3 = r2.newHistory.apply_diff(new Diff([new Delta(0, "13", "")])) as ApplyResult
            const s2 = r3.remove[0]
            const r4 = r3.newHistory.apply_operations([[Operation.Enable, r3.remove[0]]]) as ApplyResult
            r4.insert.length.should.equal(1)
            r4.insert[0].should.equal(s2)
            r4.remove.length.should.equal(0)

            r4.newHistory.text.should.equal("13")
            r4.diff.should.deep.equal(new Diff([new Delta(0, "", "13")]))
            Array.from(r4.newHistory.segments.values()).should.deep.equal([new Segment(1, "2", Status.Disabled),
                                                                           new Segment(0, "13", Status.Enabled)])
            r4.newHistory.closing.vertices.size.should.equal(1)
            r4.newHistory.closing.edges.size.should.equal(0)
        })
        u.it('toggle multiple segments', () => {
            const h1 = new SegmentHistory(new Map(), new ImmutableDirectedGraph(new Set(), new Map()), "123")
            const r2 = h1.apply_diff(new Diff([new Delta(0, "123", "456")])) as ApplyResult
            const r3 = r2.newHistory.apply_operations([[Operation.Enable, r2.remove[0]], [Operation.Disable, r2.insert[0]]]) as ApplyResult
            r3.insert.length.should.equal(1)
            r3.insert[0].should.equal(r2.remove[0])
            r3.remove.length.should.equal(1)
            r3.remove[0].should.equal(r2.insert[0])
            r3.newHistory.text.should.equal("123")
            r3.diff.should.deep.equal(new Diff([new Delta(0, "456", "123")]))
            Array.from(r3.newHistory.segments.values()).should.deep.equal([new Segment(0, "123", Status.Enabled), new Segment(3, "456", Status.Disabled)])
        })
    })
})
