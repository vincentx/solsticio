import {beforeEach, describe, expect, it} from 'vitest'
import {Registry} from '../src/registry'
import {Sandbox} from '../src/iframe/sandbox'
import {Context} from '../src/iframe/communication'

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

    it('should register plugin to registry', () => {
        _registry.plugin({id: '@core'})
        expect(_registry.plugins()).toEqual([{id: '@core'}])
    })

    it('should not register plugin if already registered', () => {
        _registry.plugin({id: '@core'})
        _registry.plugin({id: '@core'})

        expect(_registry.errors()).toEqual([{id: '@core', message: '@core already registered'}])
    })

    it('should register sandbox plugin to registry', async () => {
        sandbox({id: '@ui'})

        await _registry.sandbox('@ui', _sandbox.contentWindow!)
        expect(_registry.plugins()).toEqual([{id: '@ui'}])
    })

    it('should not register sandbox plugin if already registered', async () => {
        let other = window.document.createElement('iframe')
        window.document.body.appendChild(other)

        sandbox({id: '@ui'})
        sandbox({id: '@ui'}, other.contentWindow!)

        await _registry.sandbox('@ui', _sandbox.contentWindow!)
        await _registry.sandbox('@ui', other.contentWindow!)

        expect(_registry.errors()).toEqual([{id: '@ui', message: '@ui already registered'}])
    })

    it('should not register sandbox plugin if id not match', async () => {
        sandbox({id: '@ui-new'})

        await _registry.sandbox('@ui', _sandbox.contentWindow!)

        expect(_registry.plugins()).toEqual([])
        expect(_registry.errors()).toEqual([{id: '@ui-new', message: 'sandbox id @ui-new instead of @ui'}])
    })

    function sandbox(context: Context, target: Window = _sandbox.contentWindow!) {
        new Sandbox({
            window: target,
            context: context,
            source: _ => window
        })
    }
})