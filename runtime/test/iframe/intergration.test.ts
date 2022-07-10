import {beforeEach, describe, expect, it, vi} from 'vitest'
import {Host, Sandbox} from '../../src/iframe/sandbox'
import {ErrorCollector} from "../../src/core/error";

// @vitest-environment jsdom
describe('Host-Sandbox integration', () => {
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
    })

    describe('Call Sandbox from Host', () => {
        it('should access context info from connected sandbox', async () => {
            let host = $host()
            $sandbox({version: '1.0.0', config: {enable: true}})

            await host.connect('@sandbox', _sandbox.contentWindow!, 'https://sandbox.com')
            let sandbox = host.sandbox('@sandbox')

            expect(sandbox.version).toEqual('1.0.0')
            expect(sandbox.config.enable).toEqual(true)
        })

        it('should call sandbox callback for connected sandbox', async () => {
            $sandbox({
                callback: (parameter) => parameter,
                config: {handler: (parameter) => parameter}
            })

            let host = $host()
            await host.connect('@sandbox', _sandbox.contentWindow!, 'https://sandbox.com')
            let sandbox = host.sandbox('@sandbox')

            await expect(sandbox.callback('parameter')).resolves.toEqual('parameter')
            await expect(sandbox.config.handler('parameter')).resolves.toEqual('parameter')
        })

        it('should pass function to connected sandbox', async () => {
            let promise = new Promise<any>(resolve => {
                $sandbox({
                    callback: async (api) => {
                        let result = await api()
                        resolve(result)
                    }
                })
            })

            let host = $host()
            await host.connect('@sandbox', _sandbox.contentWindow!, 'https://sandbox.com')
            await host.sandbox('@sandbox').callback(() => 'api called')

            await expect(promise).resolves.toEqual('api called')
        })
    })

    describe('Call Host from Sandbox', () => {
        it('should access host context from connected sandbox', async () => {
            let hostPromise = $sandbox({version: '1.0.0', config: {enable: true}}).host()

            let host = $host({version: '1.2.0', config: {enable: false}})
            await host.connect('@sandbox', _sandbox.contentWindow!, 'https://sandbox.com')

            let hostContext = await hostPromise

            expect(hostContext.version).toEqual('1.2.0')
            expect(hostContext.config.enable).toEqual(false)
        })

        it('should call host function from connected sandbox', async () => {
            let hostPromise = $sandbox({version: '1.0.0', config: {enable: true}}).host()

            let host = $host({modal: {show: (parameter) => parameter}, info: (parameter) => [parameter]})
            await host.connect('@sandbox', _sandbox.contentWindow!, 'https://sandbox.com')

            let hostContext = await hostPromise

            await expect(hostContext.modal.show('showed')).resolves.toEqual('showed')
            await expect(hostContext.info('info')).resolves.toEqual(['info'])
        })
    })

    function $sandbox(context: any) {
        return new Sandbox({
            container: _sandbox.contentWindow!,
            context: context,
            errors: new ErrorCollector(e => _errors.push(e)),
            event: (e) => ({
                data: e.data,
                source: _host.contentWindow!,
                origin: 'https://host.com'
            } as MessageEvent)
        }, 'https://host.com')
    }

    function $host(context: any = {}) {
        return new Host({
            container: _host.contentWindow!,
            context: context,
            errors: new ErrorCollector(e => _errors.push(e)),
            event: (e) => ({
                data: e.data,
                source: _sandbox.contentWindow!,
                origin: 'https://sandbox.com'
            } as MessageEvent)
        })
    }
})
