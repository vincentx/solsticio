import {beforeEach, describe, expect, it} from 'vitest'
import {Host, Sandbox} from '../src/iframe-sandbox'

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
        let host = new Host(_host.contentWindow!)
        expect(host.sandbox('@undefined')).toEqual({})
    })

    it('should connect to sandbox', async () => {
        let host = new Host(_host.contentWindow!)

        sandbox({data: 'data'})

        await host.connect('@sandbox', _sandbox.contentWindow!)

        expect(host.sandbox('@sandbox')).toEqual({data: 'data'})
    })
    

    function sandbox(context: any, source: (e: MessageEvent) => Window = _ => _host.contentWindow!) {
        new Sandbox({
            sandbox: _sandbox.contentWindow!,
            context: context,
            source: source
        })
    }
})
