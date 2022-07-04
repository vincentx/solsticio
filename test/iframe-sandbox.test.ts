import {beforeEach, describe, expect, it} from "vitest";
import {Proxy} from "../src/iframe-sandbox";

// @vitest-environment jsdom
describe("iframe sandbox", () => {
    let _sandbox: HTMLIFrameElement

    beforeEach(() => {
        _sandbox = window.document.createElement('iframe')
        window.document.body.appendChild(_sandbox)
    })

    describe("proxy", () => {
        it("should return context object with corresponding response", async () => {
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
            })

            await expect(timeout(proxy.fetch(), 1000)).resolves.toEqual({data: "data"})
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
            })

            await expect(timeout(proxy.fetch(), 1000)).resolves.toEqual({data: "data"})
        })
    })


    function timeout<R>(promise: Promise<R>, time: number) {
        return Promise.race([promise, new Promise<R>((_, reject) => setTimeout(reject, time))])
    }

    type Context = {
        data: string
    }
})

