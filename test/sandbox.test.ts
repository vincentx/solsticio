import {beforeEach, describe, expect, it, vi} from "vitest";
import {Sandbox} from "../src/iframe-sandbox";
import {v4} from "uuid";

// @vitest-environment jsdom
describe("Sandbox", () => {
    let _sandbox: HTMLIFrameElement

    beforeEach(() => {
        _sandbox = window.document.createElement('iframe')
        window.document.body.appendChild(_sandbox)
        vi.mock('uuid', () => {
            return {
                v4: vi.fn()
            }
        })
    })

    describe("connection", () => {
        beforeEach(() => {
            sandbox({data: "context"})
        })

        it("should response to connect request", async () => {
            let response = waitForSandboxConnection()

            connectSandbox('connect')

            await expect(response).resolves.toEqual({id: 'connect', response: {data: 'context'}})
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
            connectSandbox('first-connect')
            connectSandbox('second-connect')

            await expect(promise).resolves.toEqual({message: 'already connected'})
        })
    })

    describe("call callback function in sandbox context", () => {
        beforeEach(() => {
            vi.mocked(v4).mockReturnValue("callback-id")
        })

        it("should return callback reference in context", async () => {
            sandbox({
                func: () => {
                }
            })

            let response = waitForSandboxConnection()

            connectSandbox('connect')

            await expect(response).resolves.toEqual({id: 'connect', response: {func: {id: 'callback-id'}}})
        })

        it("should be able to call by callback reference", async () => {
            let callback = new Promise<any>((resolve) => {
                sandbox({
                    func: () => resolve('called')
                })
            })

            waitForSandboxConnection().then(_ => call('call', 'callback-id'))
            connectSandbox('connect')

            await expect(callback).resolves.toEqual('called')
        })

        it("should not call callback if callback id inexist", async () => {
            sandbox({
                func: () => {
                }
            })

            let response = waitForSandboxConnection().then(_ => call('call', 'inexist-callback-id'))
                .then(_ => waitForSandboxResponse())

            connectSandbox('connect')

            await expect(response).resolves.toEqual({id: 'call', error: {message: 'callback not found'}})
        })
    })

    function sandbox(context: any) {
        new Sandbox({
            sandbox: _sandbox.contentWindow!,
            context: context,
            source: _ => window
        })
    }

    function connectSandbox(id: string) {
        _sandbox.contentWindow!.postMessage({id: id, type: 'context'}, '*')
    }

    function call(id: string, callback: string) {
        _sandbox.contentWindow!.postMessage({id: id, type: 'call', callback: callback}, '*')
    }

    function waitForSandboxResponse() {
        return new Promise<any>((resolve) => {
            window.addEventListener('message', (e) => resolve(e.data), {once: true})
        })
    }

    const waitForSandboxConnection = waitForSandboxResponse

    type Error = {
        message: string
    }
})