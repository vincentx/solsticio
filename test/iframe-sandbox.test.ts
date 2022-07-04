import {beforeEach, describe, expect, it} from "vitest";
import {Client, Proxy} from "../src/iframe-sandbox";

// @vitest-environment jsdom
describe("iframe sandbox", () => {
    let _frame: HTMLIFrameElement

    beforeEach(() => {
        _frame = window.document.createElement('iframe')
        window.document.body.appendChild(_frame)
    })

    it("should fetch context object from client", async () => {
        type Context = {
            data: string
        }
        let proxy = new Proxy<Context>(window, _frame.contentWindow!)
        new Client(_frame.contentWindow!, {
            data: "data"
        }, _ => window)

        await expect(timeout(proxy.fetch(), 1000)).resolves.toEqual({data: "data"})
    })

    function timeout<R>(promise: Promise<R>, time: number) {
        return Promise.race([promise, new Promise<R>((_, reject) => setTimeout(reject, time))])
    }
})