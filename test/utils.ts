import * as chai from 'chai'
chai.should()

import { ExecutionMode, ConstrainedData } from '../src/common'

function it_debug(msg: string, func: () => void | PromiseLike<any>) {
    it(msg, function () {
        ConstrainedData.mode = ExecutionMode.Debug
        return func()
    })
}
function it_release(msg: string, func: () => void | PromiseLike<any>) {
    it(msg, function () {
        ConstrainedData.mode = ExecutionMode.Release
        return func()
    })
}

export { it_debug as it, it_release }
