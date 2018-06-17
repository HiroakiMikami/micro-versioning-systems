import * as chai from 'chai'
chai.should()

import * as u from "./utils"
import { Delta, Diff } from '../src/diff'
import { ImmutableDirectedGraph } from '../src/graph'
import { SegmentHistory, Operation, ApplyResult } from '../src/segment'

describe('SegmentHistory (Complex Cases)', () => {
    u.it('case 1', () => {
        const h1 = new SegmentHistory(new Map(), new ImmutableDirectedGraph(new Set(), new Map()), "")
        const r2 = h1.apply_delta(new Delta(0, "", "myFontSize = 12;")) as ApplyResult
        const r3 = r2.newHistory.apply_delta(new Delta(2, "Font", "Rectangle")) as ApplyResult
        const r4 = r3.newHistory.apply_delta(new Delta(4, "ctangleSize", "gionArea")) as ApplyResult

        r4.newHistory.text.should.equal("myRegionArea = 12;")

        {
            const toBeDisabled11= Array.from(r4.newHistory.segments).find(elem => elem[1].text == "Re")[0]
            const toBeDisabled12 = Array.from(r4.newHistory.segments).find(elem => elem[1].text == "ctangle")[0]
            const toBeEnabled = Array.from(r4.newHistory.segments).find(elem => elem[1].text == "Font")[0]
            const r5 = r4.newHistory.apply_operations([[Operation.Disable, toBeDisabled12],
                                                       [Operation.Disable, toBeDisabled11],
                                                       [Operation.Enable, toBeEnabled]]) as ApplyResult
            r5.diff.should.deep.equal(new Diff([new Delta(2, "Re", "Font")]))
            r5.newHistory.text.should.equal("myFontgionArea = 12;")
        }
        {
            const toBeDisabled1 = Array.from(r4.newHistory.segments).find(elem => elem[1].text == "gionArea")[0]
            const toBeEnabled11 = Array.from(r4.newHistory.segments).find(elem => elem[1].text == "ctangle")[0]
            const toBeEnabled12 = Array.from(r4.newHistory.segments).find(elem => elem[1].text == "Size")[0]
            const r5 = r4.newHistory.apply_operations([[Operation.Disable, toBeDisabled1],
                                                       [Operation.Enable, toBeEnabled12],
                                                       [Operation.Enable, toBeEnabled11]]) as ApplyResult
            r5.diff.should.deep.equal(new Diff([new Delta(4, "gionArea", "ctangleSize")]))
            r5.newHistory.text.should.equal("myRectangleSize = 12;")

            const toBeDisabled21 = Array.from(r5.newHistory.segments).find(elem => elem[1].text == "Re")[0]
            const toBeDisabled22 = Array.from(r5.newHistory.segments).find(elem => elem[1].text == "ctangle")[0]
            const toBeEnabled2 = Array.from(r5.newHistory.segments).find(elem => elem[1].text == "Font")[0]
            const r6 = r5.newHistory.apply_operations([[Operation.Disable, toBeDisabled22],
                                                       [Operation.Disable, toBeDisabled21],
                                                       [Operation.Enable, toBeEnabled2]]) as ApplyResult
            r6.diff.should.deep.equal(new Diff([new Delta(2, "Rectangle", "Font")]))
            r6.newHistory.text.should.equal("myFontSize = 12;")
        }
        {
            const toBeDisabled1 = Array.from(r4.newHistory.segments).find(elem => elem[1].text == "gionArea")[0]
            const toBeEnabled11 = Array.from(r4.newHistory.segments).find(elem => elem[1].text == "ctangle")[0]
            const toBeEnabled12 = Array.from(r4.newHistory.segments).find(elem => elem[1].text == "Size")[0]
            const toBeDisabled21 = Array.from(r4.newHistory.segments).find(elem => elem[1].text == "Re")[0]
            const toBeDisabled22 = Array.from(r4.newHistory.segments).find(elem => elem[1].text == "ctangle")[0]
            const toBeEnabled2 = Array.from(r4.newHistory.segments).find(elem => elem[1].text == "Font")[0]
            const r5 = r4.newHistory.apply_operations([[Operation.Disable, toBeDisabled1],
                                                       [Operation.Enable, toBeEnabled12],
                                                       [Operation.Enable, toBeEnabled11],
                                                       [Operation.Disable, toBeDisabled22],
                                                       [Operation.Disable, toBeDisabled21],
                                                       [Operation.Enable, toBeEnabled2]]) as ApplyResult
            r5.diff.should.deep.equal(new Diff([new Delta(2, "RegionArea", "FontSize")]))
            r5.newHistory.text.should.equal("myFontSize = 12;")

        }
    })
    u.it('case 2', () => {
        const h1 = new SegmentHistory(new Map(), new ImmutableDirectedGraph(new Set(), new Map()), "")
        const r2 = h1.apply_delta(new Delta(0, "", "xyz")) as ApplyResult
        const r3 = r2.newHistory.apply_delta(new Delta(1, "y", "")) as ApplyResult
        const r4 = r3.newHistory.apply_delta(new Delta(0, "xz", "")) as ApplyResult

        r4.newHistory.text.should.equal("")

        {
            const toBeEnabled11 = Array.from(r4.newHistory.segments).find(elem => elem[1].text == "x")[0]
            const toBeEnabled12 = Array.from(r4.newHistory.segments).find(elem => elem[1].text == "z")[0]
            const r5 = r4.newHistory.apply_operations([[Operation.Enable, toBeEnabled12], [Operation.Enable, toBeEnabled11]]) as ApplyResult
            r5.diff.should.deep.equal(new Diff([new Delta(0, "", "xz")]))
            r5.newHistory.text.should.equal("xz")

            const toBeEnabled2 = Array.from(r5.newHistory.segments).find(elem => elem[1].text == "y")[0]
            const r6 = r5.newHistory.apply_operations([[Operation.Enable, toBeEnabled2]]) as ApplyResult
            r6.diff.should.deep.equal(new Diff([new Delta(1, "", "y")]))
            r6.newHistory.text.should.equal("xyz")
        }

        {
            const toBeEnabled11 = Array.from(r4.newHistory.segments).find(elem => elem[1].text == "x")[0]
            const toBeEnabled12 = Array.from(r4.newHistory.segments).find(elem => elem[1].text == "z")[0]
            const toBeEnabled2 = Array.from(r4.newHistory.segments).find(elem => elem[1].text == "y")[0]
            const r5 = r4.newHistory.apply_operations([[Operation.Enable, toBeEnabled12],
                                                       [Operation.Enable, toBeEnabled11],
                                                       [Operation.Enable, toBeEnabled2]]) as ApplyResult
            r5.diff.should.deep.equal(new Diff([new Delta(0, "", "xyz")]))
            r5.newHistory.text.should.equal("xyz")
        }
    })
})
