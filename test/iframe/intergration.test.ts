import {beforeEach, describe, expect, it, vi} from 'vitest'
import {Host, Sandbox} from '../../src/iframe/sandbox'
import {ErrorCollector} from "../../src/error";

// @vitest-environment jsdom
describe('Host-Sandbox integration', () => {
    let _sandbox: HTMLIFrameElement
    let _host: HTMLIFrameElement
    let _errors: string[]

    beforeEach(() => {
        _host = window.document.createElement('iframe')
        window.document.body.appendChild(_host)

        _sandbox = window.document.createElement('iframe')
        window.document.body.appendChild(_sandbox)

        _errors = []
    })

    describe('Call Sandbox from Host', () => {
        it('should access context info from connected sandbox', async () => {
            let host = $host()
            $sandbox({version: '1.0.0', config: {enable: true}})

            await host.connect('@sandbox', _sandbox.contentWindow!)
            let sandbox = host.sandbox('@sandbox')

            expect(sandbox.version).toEqual('1.0.0')
            expect(sandbox.config.enable).toEqual(true)
        })

        it('should call sandbox callback for connected sandbox', async () => {
            let callback = vi.fn()
            let handler = vi.fn()
            $sandbox({
                callback: callback,
                config: {handler: handler}
            })

            let host = $host()
            await host.connect('@sandbox', _sandbox.contentWindow!)
            let sandbox = host.sandbox('@sandbox')

            await sandbox.callback()
            await sandbox.config.handler()

            expect(callback).toHaveBeenCalled()
            expect(handler).toHaveBeenCalled()
        })
    })

    describe('Call Host from Sandbox', () => {
        it('should access host context from connected sandbox', async () => {
            let hostPromise = $sandbox({version: '1.0.0', config: {enable: true}}).host()

            let host = $host({version: '1.2.0', config: {enable: false}})
            await host.connect('@sandbox', _sandbox.contentWindow!)

            let hostContext = await hostPromise

            expect(hostContext.version).toEqual('1.2.0')
            expect(hostContext.config.enable).toEqual(false)
        })

        it('should call host function from connected sandbox', async () => {
            let hostPromise = $sandbox({version: '1.0.0', config: {enable: true}}).host()

            let host = $host({modal: {show: () => 'showed'}, info: () => ['host', 'context']})
            await host.connect('@sandbox', _sandbox.contentWindow!)

            let hostContext = await hostPromise

            await expect(hostContext.modal.show()).resolves.toEqual('showed')
            await expect(hostContext.info()).resolves.toEqual(['host', 'context'])
        })
    })

    function $sandbox(context: any, source: (e: MessageEvent) => Window = _ => _host.contentWindow!) {
        return new Sandbox({
            window: _sandbox.contentWindow!,
            context: context,
            source: source,
            errors: new ErrorCollector(e => _errors.push(e))
        })
    }

    function $host(context: any = {}, source: (e: MessageEvent) => Window = _ => _sandbox.contentWindow!) {
        return new Host({
            window: _host.contentWindow!,
            context: context,
            source: source,
            errors: new ErrorCollector(e => _errors.push(e))
        })
    }
})
