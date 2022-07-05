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
            new Sandbox({
                sandbox: _sandbox.contentWindow!,
                context: {
                    data: "context"
                },
                source: _ => window
            })
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
        it("should return callback reference in context", async () => {
            vi.mocked(v4).mockReturnValue("callback-id")

            new Sandbox({
                sandbox: _sandbox.contentWindow!,
                context: {
                    func: () => {
                    }
                },
                source: _ => window
            })

            let response = waitForSandboxConnection()

            connectSandbox('connect')

            await expect(response).resolves.toEqual({id: 'connect', response: {func: {id: 'callback-id'}}})
        })

        it("should be able to call by callback reference", async () => {
            vi.mocked(v4).mockReturnValue("callback-id")

            let promise = new Promise<any>((resolve) => {
                new Sandbox({
                    sandbox: _sandbox.contentWindow!,
                    context: {
                        func: () => {
                            resolve('called')
                        }
                    },
                    source: _ => window
                })
            })

            let response = waitForSandboxConnection()
            connectSandbox('connect')

            await expect(response).resolves.toEqual({id: 'connect', response: {func: {id: 'callback-id'}}})

            call('call', 'callback-id')

            await expect(promise).resolves.toEqual('called')
        })
    })

    function connectSandbox(id: string) {
        _sandbox.contentWindow!.postMessage({id: id, type: 'context'}, '*')
    }

    function call(id: string, callback: string) {
        _sandbox.contentWindow!.postMessage({id: id, type: 'call', callback: callback}, '*')
    }

    function waitForSandboxConnection() {
        return new Promise<any>((resolve) => {
            window.addEventListener('message', (e) => resolve(e.data), {once: true})
        })
    }

    type Error = {
        message: string
    }
})