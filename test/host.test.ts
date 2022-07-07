import {beforeEach, describe, expect, it} from 'vitest'
import {Host, Sandbox} from '../src/sandbox'

// @vitest-environment jsdom
describe('Host', () => {
    let _sandbox: HTMLIFrameElement
    let _host: HTMLIFrameElement

    beforeEach(() => {
        _host = window.document.createElement('iframe')
        window.document.body.appendChild(_host)

        _sandbox = window.document.createElement('iframe')
        window.document.body.appendChild(_sandbox)
    })

    it('should return empty as context for undefined sandbox', () => {
        let host = new Host(_host.contentWindow!, {}, _ => _sandbox.contentWindow!)
        expect(host.sandbox('@undefined')).toEqual({})
    })

    it('should connect to sandbox', async () => {
        let host = new Host(_host.contentWindow!, {}, _ => _sandbox.contentWindow!)

        sandbox({data: 'data'})

        await host.connect('@sandbox', _sandbox.contentWindow!)

        expect(host.sandbox('@sandbox')).toEqual({data: 'data'})
    })

    it('should call callback from sandbox context', async () => {
        let callback = new Promise<any>((resolve) => {
            sandbox({
                func: () => resolve('func called')
            })
        })

        let host = new Host(_host.contentWindow!, {}, _ => _sandbox.contentWindow!)
        await host.connect('@sandbox', _sandbox.contentWindow!)

        host.sandbox('@sandbox').func()

        await expect(callback).resolves.toEqual('func called')
    })

    it('should call callback from nested object in context', async () => {
        let callback = new Promise<any>((resolve) => {
            sandbox({
                data: {
                    func: () => resolve('func called')
                }
            })
        })

        let host = new Host(_host.contentWindow!, {}, _ => _sandbox.contentWindow!)
        await host.connect('@sandbox', _sandbox.contentWindow!)

        host.sandbox('@sandbox').data.func()

        await expect(callback).resolves.toEqual('func called')
    })

    it('should send context to sandbox when connect', async () => {
        let host = new Host(_host.contentWindow!, {
            data: 'context'
        }, _ => _sandbox.contentWindow!)

        let instance = sandbox({data: 'data'})

        await host.connect('@sandbox', _sandbox.contentWindow!)

        await expect(instance.host()).resolves.toEqual({data: 'context'})
    })

    it('should be able to call function from host', async () => {
        let host = new Host(_host.contentWindow!, {
            func: () => 'from host'
        }, _ => _sandbox.contentWindow!)

        let instance = sandbox({data: 'data'})

        await host.connect('@sandbox', _sandbox.contentWindow!)

        let hostContext = await instance.host()

        await expect(hostContext.func()).resolves.toEqual('from host')
    })

    it('should be able to call function nested in host context', async () => {
        let host = new Host(_host.contentWindow!, {
            data: {
                func: () => 'from host'
            }
        }, _ => _sandbox.contentWindow!)

        let instance = sandbox({data: 'data'})

        await host.connect('@sandbox', _sandbox.contentWindow!)

        let hostContext = await instance.host()

        await expect(hostContext.data.func()).resolves.toEqual('from host')
    })

    function sandbox(context: any, source: (e: MessageEvent) => Window = _ => _host.contentWindow!) {
        return new Sandbox({
            sandbox: _sandbox.contentWindow!,
            context: context,
            source: source
        })
    }
})
