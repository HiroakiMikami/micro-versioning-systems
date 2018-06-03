import * as chai from 'chai'
chai.should()

import * as u from "./utils"
import { Dummy } from '../src/main'

describe('Dummy', () => {

    u.it('#constructor', () => {
        const x = new Dummy('test')

        x.x.should.equal("test")
    })
})