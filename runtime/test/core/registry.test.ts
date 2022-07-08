import {beforeEach, describe, expect, it} from 'vitest'
import {Registry} from '../../src/core/registry'
import {Sandbox} from '../../src/iframe/sandbox'
import {Context} from '../../src/iframe/communication'
import {ErrorCollector} from "../../src/core/error";

//@vitest-environment jsdom
describe('Plugin Registry', () => {
    let _registry: Registry
    let _sandbox: HTMLIFrameElement
    let _errors: string[]

    beforeEach(() => {
        _registry = new Registry({
            container: window,
            context: {},
            source: _ => _sandbox.contentWindow!,
            errors: new ErrorCollector(_ => _)
        }, new ErrorCollector(e => _errors.push(e)))

        _sandbox = window.document.createElement('iframe')
        window.document.body.appendChild(_sandbox)
        _errors = []
    })

    it('should register plugin to registry', () => {
        _registry.plugin({id: '@core'})
        expect(_registry.plugins()).toEqual([{id: '@core'}])
    })

    it('should not register plugin if already registered', () => {
        _registry.plugin({id: '@core'})
        _registry.plugin({id: '@core'})

        expect(_errors).toEqual(['@core already registered'])
    })

    it('should register sandbox plugin to registry', async () => {
        sandbox({id: '@ui', extensions: [{name: 'extension', extensionPoint: '@core/buttons', action: () => 'click'}]})

        await _registry.sandbox('@ui', _sandbox.contentWindow!)
        let plugin = _registry.plugins()[0]

        expect(plugin.id).toEqual('@ui')
        expect(plugin.extensions![0].name).toEqual('extension')
        expect(plugin.extensions![0].extensionPoint).toEqual('@core/buttons')
        // @ts-ignore
        expect(typeof plugin.extensions![0].action).toEqual('function')
    })


    it('should not register sandbox plugin if already registered', async () => {
        let other = window.document.createElement('iframe')
        window.document.body.appendChild(other)

        sandbox({id: '@ui', extensionPoints: []})
        sandbox({id: '@ui'}, other.contentWindow!)

        await _registry.sandbox('@ui', _sandbox.contentWindow!)
        await _registry.sandbox('@ui', other.contentWindow!)

        expect(_registry.plugins()).toEqual([{id: '@ui', extensionPoints: []}])
        expect(_errors).toEqual(['@ui already registered'])
    })

    it('should not register sandbox plugin if id not match', async () => {
        sandbox({id: '@ui-new'})

        await _registry.sandbox('@ui', _sandbox.contentWindow!)

        expect(_registry.plugins()).toEqual([])
        expect(_errors).toEqual(['sandbox @ui-new can not be registered as @ui'])
    })

    it('should not register sandbox plugin if not valid plugin type', async () => {
        sandbox({})

        await _registry.sandbox('@ui', _sandbox.contentWindow!)

        expect(_registry.plugins()).toEqual([])
        expect(_errors).toEqual(['sandbox @ui is not a plugin'])
    })

    function sandbox(context: Context, target: Window = _sandbox.contentWindow!) {
        new Sandbox({
            container: target,
            context: context,
            source: _ => window,
            errors: new ErrorCollector(_ => _)
        })
    }
})