import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'
import {Host} from '../../src/iframe/sandbox'
import * as Communication from '../../src/iframe/communication'
import {CallableRequest, CallableResponse, Local} from '../../src/iframe/communication'
import {ErrorCollector} from "../../src/core/error";

//@vitest-environment jsdom
describe('Host', () => {
    let _host: HTMLIFrameElement
    let _sandbox: HTMLIFrameElement
    let _errors: (m: string) => void
    let _errorReceived: Promise<string>

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

    let _fromRemoteCalled = {context: 'sandbox'}
    let _remoteReturns = {context: 'sandbox from remote'}

    beforeEach(() => {
        _host = window.document.createElement('iframe')
        window.document.body.appendChild(_host)

        _sandbox = window.document.createElement('iframe')
        window.document.body.appendChild(_sandbox)

        _errorReceived = new Promise<string>((resolve) => {
            _errors = m => resolve(m)
        })
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
            _remote.send.mockResolvedValue(_remoteReturns)
            _remote.fromRemote.mockReturnValue(sandboxContext)

            let instance = host()
            await instance.connect('@sandbox', _sandbox.contentWindow!)

            expect(instance.sandbox('@sandbox')).toEqual(sandboxContext)

            expect(_remote.fromRemote.mock.lastCall![0]).toEqual(_remoteReturns)
            expect(_remote.fromRemote.mock.lastCall![1]).toBe(_sandbox.contentWindow!)
        })

        it('should not connect to sandbox if already connected with same id', async () => {
            let sandboxContext = {context: 'sandbox'}
            _remote.send.mockResolvedValue(_fromRemoteCalled)
            _remote.fromRemote.mockReturnValue(sandboxContext)

            let instance = host()
            await instance.connect('@sandbox', _sandbox.contentWindow!)

            let other = window.document.createElement('iframe')
            window.document.body.appendChild(other)

            await expect(instance.connect('@sandbox', other.contentWindow!)).rejects.toEqual('@sandbox already registered')
        })
    })

    describe('access remote sandbox context', () => {
        beforeEach(() => {
            _remote.send.mockResolvedValue(_remoteReturns)
            _remote.fromRemote.mockReturnValue(_fromRemoteCalled)
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
            _remote.send.mockResolvedValue(_remoteReturns)
            _remote.fromRemote.mockReturnValue(_fromRemoteCalled)
        })

        it('should handle call request from connected sandbox', async () => {
            let request = new Promise((resolve) => {
                _local.receive.mockImplementation((request: CallableRequest, fromRemote: (p: any) => any) => {
                    resolve([request, fromRemote('something')])
                })
            })

            let instance = host()
            await instance.connect('@sandbox', _sandbox.contentWindow!)

            hostReceive(callRequest)
            await expect(request).resolves.toEqual([callRequest, _fromRemoteCalled])
        })

        it('should not handle call request from unconnected sandbox', async () => unknownHost(callRequest))

        it('should not handle call request from sandbox during connection', async () => {
            _remote.send.mockReturnValue(new Promise<any>((_) => {
            }))
            let response = waitForSandboxResponse()

            let instance = host()
            instance.connect('@sandbox', _sandbox.contentWindow!)

            hostReceive(callRequest)
            await expect(response).resolves.toEqual({
                id: callRequest.id,
                type: 'error',
                error: {message: 'not allowed'}
            })
        })

        it('should send result back to remote sandbox', async () => {
            let response = waitForSandboxResponse()
            _local.receive.mockReturnValue('result')
            _local.toRemote.mockReturnValue('expose to remote result')

            let instance = host()
            await instance.connect('@sandbox', _sandbox.contentWindow!)

            hostReceive(callRequest)

            await expect(response).resolves.toEqual({
                id: callRequest.id,
                type: 'response',
                response: 'expose to remote result'
            })
        })
    })

    it('should collect error sent from sandbox', async () => {
        host()
        hostReceive({id: 'error-id', type: 'error', error: {message: 'error message'}})
        await expect(_errorReceived).resolves.toEqual('error message')
    })

    async function unknownHost(message: CallableRequest | CallableResponse) {
        let response = waitForSandboxResponse()

        host()

        hostReceive(message)
        await expect(response).resolves.toEqual({id: message.id, type: 'error', error: {message: 'not allowed'}})
    }

    function host(context: any = _hostContext, source: (e: MessageEvent) => Window = _ => _sandbox.contentWindow!) {
        return new Host({
            container: _host.contentWindow!,
            context: context,
            source: source,
            errors: new ErrorCollector(_errors)
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
        callable: 'callable',
        parameters: []
    }

    const sandboxResponse: CallableResponse = {
        id: 'message-id',
        type: 'response',
        response: 'any'
    }
})