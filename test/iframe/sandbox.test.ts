import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'
import {Sandbox} from '../../src/iframe/sandbox'
import * as Communication from '../../src/iframe/communication'
import {CallableRequest, CallableResponse} from '../../src/iframe/communication'

// @vitest-environment jsdom
describe('Sandbox', () => {
    let _sandbox: HTMLIFrameElement

    beforeEach(() => {
        _sandbox = window.document.createElement('iframe')
        window.document.body.appendChild(_sandbox)
    })

    describe('connect with remote host', () => {
        beforeEach(() => {
            sandbox({data: 'context'})
        })

        it('should expose local context to remote host', async () => {
            let response = waitForSandboxConnection()

            connectSandbox()

            await expect(response).resolves.toEqual({id: 'connect', type: 'response', response: {data: 'context'}})
        })

        it('should not connect to another host if already connected', async () => {
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

    describe('access remote host context', () => {
        const _remote = {
            fromRemote: vi.fn(),
            receive: vi.fn()
        }

        const _hostContext = {context: 'host'}

        beforeEach(() => {
            // @ts-ignore
            vi.spyOn(Communication, 'Remote').mockImplementation(() => _remote)
        })

        afterEach(() => {
            vi.resetAllMocks()
        })

        it('should build remote context after connection', async () => {
            _remote.fromRemote.mockReturnValue({context: 'remote host'})

            let host = sandbox().host()

            connectSandbox('connect', _hostContext)
            await waitForSandboxConnection()

            await expect(host).resolves.toEqual({context: 'remote host'})
            expect(_remote.fromRemote.mock.lastCall![0]).toBe(_hostContext)
        })

        it('should handle remote host response', async () => {
            let response = new Promise((resolve) => {
                _remote.fromRemote.mockReturnValue({context: 'remote host'})
                _remote.receive.mockImplementation((response: CallableResponse) => {
                    resolve(response)
                })
            })

            sandbox()
            connectSandbox('connect', _hostContext)
            waitForSandboxConnection().then(_ => send(hostResponse))


            await expect(response).resolves.toEqual(hostResponse)
        })

        it('should not handle response if host not connected', async () => notConnected(hostResponse))

        it('should not handle response from unknown host', async () => unknownHost(hostResponse))
    })

    describe('export context to remote host', () => {
        const _local = {
            toRemote: vi.fn(),
            receive: vi.fn(),
        }

        beforeEach(() => {
            // @ts-ignore
            vi.spyOn(Communication, 'Local').mockImplementation(() => _local)
        })

        it('should handle call request from host', async () => {
            let request = new Promise((resolve) => {
                _local.receive.mockImplementation((request: CallableRequest) => {
                    resolve(request)
                })
            })

            sandbox()

            waitForSandboxConnection().then(_ => send(callRequest))
            connectSandbox()

            await expect(request).resolves.toEqual(callRequest)
        })

        it('should not handle call request if host not connected', async () => notConnected(callRequest))

        it('should not handle call request from unknown host', async () => unknownHost(callRequest))
    })

    async function notConnected(message: { id: string }) {
        sandbox()
        let response = waitForSandboxResponse()
        _sandbox.contentWindow!.postMessage(message, '*')

        await expect(response).resolves.toEqual({id: message.id, error: {message: 'not connected'}})
    }

    async function unknownHost(message: { id: string }) {
        let source = vi.fn()

        let unknown = window.document.createElement('iframe')
        window.document.body.appendChild(unknown)

        sandbox({}, source)

        source.mockReturnValueOnce(window)
        source.mockReturnValueOnce(unknown.contentWindow!)

        let response = waitForSandboxConnection()
            .then(_ => _sandbox.contentWindow!.postMessage(message, '*'))
            .then(_ => waitForSandboxResponse(unknown.contentWindow!))

        connectSandbox()

        await expect(response).resolves.toEqual({id: message.id, error: {message: 'not allowed'}})
    }

    function sandbox(context: any = {}, source: (e: MessageEvent) => Window = _ => window) {
        return new Sandbox({
            window: _sandbox.contentWindow!,
            context: context,
            source: source
        })
    }

    function connectSandbox(id: string = 'connect', context: any = {}) {
        _sandbox.contentWindow!.postMessage({id: id, type: 'context', context: context}, '*')
    }

    function send(message: any) {
        _sandbox.contentWindow!.postMessage(message, '*')
    }

        function waitForSandboxResponse(target: Window = window) {
            return new Promise<any>((resolve) => {
                target.addEventListener('message', (e) => resolve(e.data), {once: true})
            })
        }

    const waitForSandboxConnection = waitForSandboxResponse

    const callRequest = {
        id: 'message-id', type: 'call', callable: 'callable'
    }

    const hostResponse = {
        id: 'message-id', type: 'response', response: 'response'
    }

    type Error = {
        message: string
    }
})