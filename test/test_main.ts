import * as chai from 'chai'
chai.should()

import { Dummy } from '../src/main'

describe('Dummy', () => {

    it('#constructor', () => {
        const x = new Dummy('test')

        x.x.should.equal("test")
    })
})