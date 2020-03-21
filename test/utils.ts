import * as chai from 'chai'
chai.should()

import { ExecutionMode, ConstrainedData } from '../src/common'

function itDebug(msg: string, func: () => void | PromiseLike<void>): void {
    it(msg, function () {
        ConstrainedData.mode = ExecutionMode.Debug
        return func()
    })
}
function itRelease(msg: string, func: () => void | PromiseLike<void>): void {
    it(msg, function () {
        ConstrainedData.mode = ExecutionMode.Release
        return func()
    })
}

export { itDebug as it, itRelease as itRelease }
