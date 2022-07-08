import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'
import {Host} from '../../src/iframe/sandbox'
import * as Communication from '../../src/iframe/communication'
import {CallableRequest, CallableResponse} from '../../src/iframe/communication'

//@vitest-environment jsdom
describe('Host', () => {
    let _host: HTMLIFrameElement
    let _sandbox: HTMLIFrameElement

    const _remote = {
        fromRemote: vi.fn(),
        receive: vi.fn(),
        send: vi.fn()
    }

    const _local = {
        toRemote: vi.fn(),
        receive: vi.fn(),
    }

    const _hostContext = {
        context: 'host'
    }

    beforeEach(() => {
        _host = window.document.createElement('iframe')
        window.document.body.appendChild(_host)

        _sandbox = window.document.createElement('iframe')
        window.document.body.appendChild(_sandbox)

        // @ts-ignore
        vi.spyOn(Communication, 'Remote').mockImplementation(() => _remote)
        // @ts-ignore
        vi.spyOn(Communication, 'Local').mockImplementation(() => _local)
    })

    afterEach(() => {
        vi.resetAllMocks()
    })

    describe('connect sandbox', () => {
        it('should return empty context for undefined sandbox', () => {
            let instance = host()
            expect(instance.sandbox('@undefined')).toEqual({})
        })

        it('should send connect request to remote sandbox', () => {
            _remote.send.mockReturnValue(new Promise<any>((_) => {
            }))
            _local.toRemote.mockReturnValue('remote context')

            let instance = host()
            instance.connect('@sandbox', _sandbox.contentWindow!)

            expect(_remote.send.mock.lastCall![0]).toBe(_sandbox.contentWindow!)
            expect(_remote.send.mock.lastCall![1]('message-id')).toEqual({
                id: 'message-id',
                type: 'context',
                context: 'remote context'
            })
        })

        it('should register remote context to connected sandbox', async () => {
            let sandboxContext = {context: 'sandbox'}
            _remote.send.mockResolvedValue({context: 'sandbox from remote'})
            _remote.fromRemote.mockReturnValue(sandboxContext)

            let instance = host()
            await instance.connect('@sandbox', _sandbox.contentWindow!)

            expect(instance.sandbox('@sandbox')).toEqual(sandboxContext)

            expect(_remote.fromRemote.mock.lastCall![0]).toEqual({context: 'sandbox from remote'})
            expect(_remote.fromRemote.mock.lastCall![1]).toBe(_sandbox.contentWindow!)
        })

        //TODO sandbox with same id
    })

    describe('access remote sandbox context', () => {
        beforeEach(() => {
            _remote.send.mockResolvedValue({context: 'sandbox from remote'})
            _remote.fromRemote.mockReturnValue({context: 'sandbox'})
        })

        it('should handle remote response from connected sandbox', async () => {
            let response = new Promise((resolve) => {
                _remote.receive.mockImplementation((response: CallableResponse) => {
                    resolve(response)
                })
            })
            let instance = host()
            await instance.connect('@sandbox', _sandbox.contentWindow!)

            hostReceive(sandboxResponse)

            await expect(response).resolves.toEqual(sandboxResponse)
        })

        it('should not handle remote response from unconnected sandbox', async () => unknownHost(sandboxResponse))
    })

    describe('expose context to remote sandbox', () => {
        beforeEach(() => {
            _remote.send.mockResolvedValue({context: 'sandbox from remote'})
            _remote.fromRemote.mockReturnValue({context: 'sandbox'})
        })

        it('should handle call request from connected sandbox', async () => {
            let request = new Promise((resolve) => {
                _local.receive.mockImplementation((request: CallableRequest) => {
                    resolve(request)
                })
            })

            let instance = host()
            await instance.connect('@sandbox', _sandbox.contentWindow!)

            hostReceive(callRequest)
            await expect(request).resolves.toEqual(callRequest)
        })

        it('should not handle call request from unconnected sandbox', async () => unknownHost(callRequest))

        it('should not handle call request from sandbox during connection', async () => {
            _remote.send.mockReturnValue(new Promise<any>((_) => {}))
            let response = waitForSandboxResponse()

            let instance = host()
            instance.connect('@sandbox', _sandbox.contentWindow!)

            hostReceive(callRequest)
            await expect(response).resolves.toEqual({id: callRequest.id, error: {message: 'not allowed'}})
        })

        it('should send result back to remote sandbox', async () => {
            let response = waitForSandboxResponse()
            _local.receive.mockReturnValue('result')

            let instance = host()
            await instance.connect('@sandbox', _sandbox.contentWindow!)

            hostReceive(callRequest)

            await expect(response).resolves.toEqual({id: callRequest.id, type: 'response', response: 'result'})
        })
    })

    async function unknownHost(message: CallableRequest | CallableResponse) {
        let response = waitForSandboxResponse()

        host()

        hostReceive(message)
        await expect(response).resolves.toEqual({id: message.id, error: {message: 'not allowed'}})
    }

    function host(context: any = _hostContext, source: (e: MessageEvent) => Window = _ => _sandbox.contentWindow!) {
        return new Host({
            window: _host.contentWindow!,
            context: context,
            source: source
        })
    }

    function hostReceive(message: any) {
        _host.contentWindow!.postMessage(message, '*')
    }

    function waitForSandboxResponse(target: Window = _sandbox.contentWindow!) {
        return new Promise<any>((resolve) => {
            target.addEventListener('message', (e) => resolve(e.data), {once: true})
        })
    }

    const callRequest: CallableRequest = {
        id: 'message-id',
        type: 'call',
        callable: 'callable'
    }

    const sandboxResponse: CallableResponse = {
        id: 'message-id',
        type: 'response',
        response: 'any'
    }
})