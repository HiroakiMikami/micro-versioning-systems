import * as chai from 'chai'
chai.should()

import { ExecutionMode, ConstrainedData } from '../src/common'

class InvalidData extends ConstrainedData {
    public validate(): string | null { return "error" }
}

describe('ConstrainedData', () => {
    describe('#constructor', () => {
        it('run assert if the execution mode is Debug', () => {
            ConstrainedData.mode = ExecutionMode.Debug;
            (() => { new InvalidData() }).should.throw()
        })
        it('ignore invalid data structure if the execution mode is Release', () => {
            ConstrainedData.mode = ExecutionMode.Release;
            (() => { new InvalidData() }).should.not.throw()
        })
    })
})