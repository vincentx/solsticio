import {beforeEach, describe, expect, it} from 'vitest'
import {Proxy} from '../src/iframe-sandbox'

// @vitest-environment jsdom
describe('iframe sandbox', () => {
    let _sandbox: HTMLIFrameElement

    beforeEach(() => {
        _sandbox = window.document.createElement('iframe')
        window.document.body.appendChild(_sandbox)
    })

    describe('proxy', () => {
        it('should return context object with matched response', async () => {
            let proxy = new Proxy<DataContext>(window, _sandbox.contentWindow!)

            _sandbox.contentWindow!.addEventListener('message', (e) => {
                let message = e.data as { id: string, request: string }
                expect(message.request).toEqual('context')

                window.postMessage({
                    id: message.id,
                    response: {
                        data: 'data'
                    }
                }, '*')
            }, {once: true})

            await expect(proxy.fetch(500, {data: 'default'})).resolves.toEqual({data: 'data'})
        })

        it('should not use object with mismatched message id', async () => {
            let proxy = new Proxy<DataContext>(window, _sandbox.contentWindow!)

            _sandbox.contentWindow!.addEventListener('message', (e) => {
                let message = e.data as { id: string, request: string }
                expect(message.request).toEqual('context')

                window.postMessage({
                    id: 'something else',
                    response: {
                        data: 'not matched'
                    }
                }, '*')

                window.postMessage({
                    id: message.id,
                    response: {
                        data: 'data'
                    }
                }, '*')
            }, {once: true})

            await expect(proxy.fetch(500, {data: 'default'})).resolves.toEqual({data: 'data'})
        })

        it('should return default context if no response from sandbox', async () => {
            let proxy = new Proxy<DataContext>(window, _sandbox.contentWindow!)

            await expect(proxy.fetch(100, {data: 'default'})).resolves.toEqual({data: 'default'})
        })
    })

    type DataContext = {
        data: string
    }
})

