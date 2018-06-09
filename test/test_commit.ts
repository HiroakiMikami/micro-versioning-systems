import * as chai from 'chai'
chai.should()

import * as u from "./utils"
import { Status, Operation } from '../src/common'
/*
import { Interval, Status, Operation } from '../src/common'
import { Delta, Diff, DeleteNonExistingText } from '../src/diff'
import { ImmutableDirectedGraph } from '../src/graph'
*/
import { Commit } from '../src/commit'

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
