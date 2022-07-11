import {beforeEach, describe, expect, it} from 'vitest'
import {Registry} from '../../src/core/registry'
import {Sandbox} from '../../src/iframe/sandbox'
import {Context} from '../../src/iframe/duplex'
import Collector from "../../src/error";

//@vitest-environment jsdom
describe('Plugin Registry', () => {
    let _registry: Registry

    let _sandbox: HTMLIFrameElement
    let _host: HTMLIFrameElement
    let _errors: string[]

    beforeEach(() => {
        _host = window.document.createElement('iframe')
        _host.src = 'https://host.com'
        window.document.body.appendChild(_host)

        _sandbox = window.document.createElement('iframe')
        _sandbox.src = 'https://sandbox.com'
        window.document.body.appendChild(_sandbox)

        _errors = []

        _registry = new Registry({
            container: _host.contentWindow!,
            context: {},
            errors: new Collector(_ => _),
            log: silence,
            event: (e) => ({
                data: e.data,
                source: _sandbox.contentWindow!,
                origin: 'https://sandbox.com'
            } as MessageEvent)
        }, new Collector(e => _errors.push(e)))
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

        await _registry.sandbox({id: '@ui', src: 'https://sandbox.com', window: _sandbox.contentWindow!})

        let plugin = _registry.plugins()[0]

        expect(plugin.id).toEqual('@ui')
        expect(plugin.extensions![0].name).toEqual('extension')
        expect(plugin.extensions![0].extensionPoint).toEqual('@core/buttons')
        // @ts-ignore
        expect(typeof plugin.extensions![0].action).toEqual('function')
    })


    it('should not register sandbox plugin if already registered', async () => {
        let other = window.document.createElement('iframe')
        other.src = 'https://other.com'
        window.document.body.appendChild(other)

        sandbox({id: '@ui', extensionPoints: []})
        sandbox({id: '@ui'}, other.contentWindow!)

        await _registry.sandbox({
            id: '@ui',
            window: _sandbox.contentWindow!,
            src: 'https://sandbox.com'
        })
        await _registry.sandbox({
            id: '@ui',
            window: other.contentWindow!,
            src: 'https://other.com'
        })

        expect(_registry.plugins()).toEqual([{id: '@ui', extensionPoints: []}])
        expect(_errors).toEqual(['@ui already registered'])
    })

    it('should not register sandbox plugin if id not match', async () => {
        sandbox({id: '@ui-new'})

        await _registry.sandbox({
            id: '@ui',
            window: _sandbox.contentWindow!,
            src: 'https://sandbox.com'
        })

        expect(_registry.plugins()).toEqual([])
        expect(_errors).toEqual(['sandbox @ui-new can not be registered as @ui'])
    })

    it('should not register sandbox plugin if not valid plugin type', async () => {
        sandbox({})

        await _registry.sandbox({
            id: '@ui',
            window: _sandbox.contentWindow!,
            src: 'https://sandbox.com'
        })

        expect(_registry.plugins()).toEqual([])
        expect(_errors).toEqual(['sandbox @ui is not a plugin'])
    })

    it('should collect error if src is not valid url', () => {
        _registry.sandbox({
            id: '@ui',
            window: _sandbox.contentWindow!,
            src: 'not a url'
        })

        expect(_errors).toEqual(['invalid src'])
    })

    function sandbox(context: Context, target: Window = _sandbox.contentWindow!) {
        new Sandbox({
            container: target,
            context: context,
            errors: new Collector(_ => _),
            log: silence,
            event: (e) => ({
                data: e.data,
                source: _host.contentWindow!,
                origin: 'https://host.com'
            } as MessageEvent)
        }, 'https://host.com')
    }
})

function silence(..._: any[]) {
}
