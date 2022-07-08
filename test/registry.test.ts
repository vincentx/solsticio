import {beforeEach, describe, expect, it} from 'vitest'
import {Registry} from '../src/registry'
import {Sandbox} from '../src/iframe/sandbox'
import {Context} from "../src/iframe/communication";

//@vitest-environment jsdom
describe('Plugin Registry', () => {
    let _registry: Registry

    let _sandbox: HTMLIFrameElement

    beforeEach(() => {
        _registry = new Registry({
            window: window,
            context: {},
            source: _ => _sandbox.contentWindow!
        })

        _sandbox = window.document.createElement('iframe')
        window.document.body.appendChild(_sandbox)
    })

    it('should registry plugin to registry', () => {
        _registry.plugin({id: '@core'})
        expect(_registry.plugins()).toEqual([{id: '@core'}])
    })

    it('should registry sandbox plugin to registry', async () => {
        sandbox({id: '@ui'})

        await _registry.sandbox('@ui', _sandbox.contentWindow!)
        expect(_registry.plugins()).toEqual([{id: '@ui'}])
    })

    function sandbox(context: Context) {
        new Sandbox({
            window: _sandbox.contentWindow!,
            context: context,
            source: _ => window
        })
    }
})