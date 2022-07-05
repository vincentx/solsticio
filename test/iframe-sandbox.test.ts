import {beforeEach, describe, expect, it} from "vitest";
import {Proxy, Sandbox} from "../src/iframe-sandbox";

// @vitest-environment jsdom
describe("iframe sandbox", () => {
    let _sandbox: HTMLIFrameElement

    beforeEach(() => {
        _sandbox = window.document.createElement('iframe')
        window.document.body.appendChild(_sandbox)
    })

    describe("proxy", () => {
        it("should return context object with matched response", async () => {
            let proxy = new Proxy<Context>(window, _sandbox.contentWindow!)

            _sandbox.contentWindow!.addEventListener("message", (e) => {
                let message = e.data as { id: string, request: string }
                expect(message.request).toEqual("context")

                window.postMessage({
                    id: message.id,
                    response: {
                        data: "data"
                    }
                }, "*")
            }, {once: true})

            await expect(proxy.fetch(500, {data: "default"})).resolves.toEqual({data: "data"})
        })

        it("should not use object with mismatched message id", async () => {
            let proxy = new Proxy<Context>(window, _sandbox.contentWindow!)

            _sandbox.contentWindow!.addEventListener("message", (e) => {
                let message = e.data as { id: string, request: string }
                expect(message.request).toEqual("context")

                window.postMessage({
                    id: 'something else',
                    response: {
                        data: "not matched"
                    }
                }, "*")

                window.postMessage({
                    id: message.id,
                    response: {
                        data: "data"
                    }
                }, "*")
            }, {once: true})

            await expect(proxy.fetch(500, {data: "default"})).resolves.toEqual({data: "data"})
        })

        it("should return default context if no response from sandbox", async () => {
            let proxy = new Proxy<Context>(window, _sandbox.contentWindow!)

            await expect(proxy.fetch(100, {data: "default"})).resolves.toEqual({data: "default"})
        })
    })

    describe("sandbox", () => {
        beforeEach(() => {
            new Sandbox({
                sandbox: _sandbox.contentWindow!,
                context: {
                    data: "context"
                },
                source: _ => window
            })
        })

        it("should response to connect request", async () => {
            let promise = new Promise<Context>((resolve) => {

                window.addEventListener('message', (e) => {
                    let response = e.data as { id: string, response: Context }
                    expect(response.id).toEqual('message id')
                    resolve(response.response)
                }, {once: true})
            })

            _sandbox.contentWindow!.postMessage({
                id: 'message id',
                request: 'context'
            }, '*')

            await expect(promise).resolves.toEqual({data: 'context'})
        })

        it("should not response to connect if already connected", async () => {
            let promise = new Promise<Error>((resolve) => {
                window.addEventListener('message', (_) => {
                    window.addEventListener('message', (e) => {
                        let response = e.data as { id: string, error: Error }
                        expect(response.id).toEqual('second-connect')
                        resolve(response.error)
                    }, {once: true})
                }, {once: true})
            })

            _sandbox.contentWindow!.postMessage({
                id: 'first-connect',
                request: 'context'
            }, '*')


            _sandbox.contentWindow!.postMessage({
                id: 'second-connect',
                request: 'context'
            }, '*')

            await expect(promise).resolves.toEqual({message: 'already connected'})
        })
    })

    type Context = {
        data: string
    }

    type Error = {
        message: string
    }
})

