import {beforeEach, describe, expect, it} from 'vitest'
import SandboxRuntime from '../../src/core/sandbox-runtime'
import {Sandbox} from '../../src/iframe/sandbox'
import {Context} from '../../src/iframe/duplex'
import Collector from "../../src/error";
import {ExtensionPoints} from "../../src/core/runtime";

//@vitest-environment jsdom
describe('Runtime that supports Sandbox plugin', () => {
    let _registry: SandboxRuntime

    let _sandbox: HTMLIFrameElement
    let _host: HTMLIFrameElement
    let _errors: string[]

    beforeEach(() => {
        _sandbox = window.document.createElement('iframe')
        _sandbox.src = 'https://sandbox.com'
        window.document.body.appendChild(_sandbox)

        _host = window.document.createElement('iframe')
        _host.src = 'https://host.com'

        window.document.body.appendChild(_host)

        _errors = []
    })

    it('should register plugin extension points to runtime', () => {
        _registry = registry({id: '@core', extensionPoints: [{name: 'buttons'}]})
        expect(_registry.extensionPoints()).toEqual(['@core/buttons'])
    })

    it('should not register plugin to runtime if already registered', () => {
        _registry = registry(
            {id: '@core', extensionPoints: [{name: 'buttons'}]},
            {id: '@core', extensionPoints: [{name: 'buttons'}]})

        expect(_registry.extensionPoints()).toEqual(['@core/buttons'])
        expect(_errors).toEqual(['plugin @core : @core already installed'])
    })

    it('should register sandbox plugin to registry', async () => {
        _registry = registry({id: '@core', extensionPoints: [{name: 'buttons'}]})

        sandbox({id: '@ui', extensions: [{name: 'extension', extensionPoint: '@core/buttons', action: () => 'click'}]})

        await _registry.sandbox('@ui', 'https://sandbox.com', _sandbox.contentWindow!)

        let extensions = _registry.extensions('@core/buttons')

        expect(extensions.length).toEqual(1)
        expect(extensions[0]['id']).toEqual('@ui/extension')
        expect(extensions[0]['name']).toEqual('extension')
        expect(extensions[0]['extensionPoint']).toEqual('@core/buttons')
        expect(typeof extensions[0]['action']).toEqual('function')
    })


    it('should not register sandbox plugin if already registered', async () => {
        _registry = registry()

        let other = window.document.createElement('iframe')
        other.src = 'https://other.com'
        window.document.body.appendChild(other)

        sandbox({id: '@ui', extensions: []})
        sandbox({id: '@ui', extensions: []}, other.contentWindow!)

        await _registry.sandbox('@ui', 'https://sandbox.com', _sandbox.contentWindow!)
        await _registry.sandbox('@ui', 'https://other.com', other.contentWindow!)

        expect(_errors).toEqual(['@ui already registered'])
    })

    it('should not register sandbox plugin if id not match', async () => {
        _registry = registry()

        sandbox({id: '@ui-new', extensions: []})

        await _registry.sandbox('@ui', 'https://sandbox.com', _sandbox.contentWindow!)

        expect(_errors).toEqual(['sandbox @ui-new can not be registered as @ui'])
    })

    it('should not register sandbox plugin if not valid plugin type', async () => {
        _registry = registry()

        sandbox({})

        await _registry.sandbox('@ui', 'https://sandbox.com', _sandbox.contentWindow!)

        expect(_errors).toEqual(['sandbox @ui is not an extensions plugin'])
    })

    it('should collect error if src is not valid url', () => {
        _registry = registry()

        _registry.sandbox('@ui', 'not a url', _sandbox.contentWindow!)

        expect(_errors).toEqual(['invalid src'])
    })

    function registry(...extensionPoints: ExtensionPoints[]) {

        return new SandboxRuntime({
            container: _host.contentWindow!,
            context: {},
            errors: new Collector(e => _errors.push(e)),
            log: silence,
            event: (e) => ({
                data: e.data,
                source: _sandbox.contentWindow!,
                origin: 'https://sandbox.com'
            } as MessageEvent)
        }).define(...extensionPoints)
    }

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
