import {beforeEach, describe, expect, it} from "vitest";
import {Sandbox, Proxy} from "../src/iframe-sandbox";

// @vitest-environment jsdom
describe("iframe sandbox", () => {
    let _sandbox: HTMLIFrameElement

    beforeEach(() => {
        _sandbox = window.document.createElement('iframe')
        window.document.body.appendChild(_sandbox)
    })

    it("should fetch context object from sand box", async () => {
        type Context = {
            data: string
        }
        let proxy = new Proxy<Context>(window, _sandbox.contentWindow!)
        new Sandbox(_sandbox.contentWindow!, {
            data: "data"
        }, _ => window)

        await expect(timeout(proxy.fetch(), 1000)).resolves.toEqual({data: "data"})
    })

    function timeout<R>(promise: Promise<R>, time: number) {
        return Promise.race([promise, new Promise<R>((_, reject) => setTimeout(reject, time))])
    }
})