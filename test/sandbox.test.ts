import {beforeEach, describe, expect, it, vi} from 'vitest'
import {Sandbox} from '../src/sandbox'
import {v4} from 'uuid'

// @vitest-environment jsdom
describe('Sandbox', () => {
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

    describe('connection', () => {
        beforeEach(() => {
            sandbox({data: 'context'})
        })

        it('should response to connect request', async () => {
            let response = waitForSandboxConnection()

            connectSandbox('connect')

            await expect(response).resolves.toEqual({id: 'connect', response: {data: 'context'}})
        })

        it('should not response to connect if already connected', async () => {
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

    describe('access host context', () => {
        let _instance: Sandbox
        beforeEach(() => {
            _instance = sandbox({data: 'context'})
        })

        it('should access host context', async () => {
            let host = _instance.host()
            connectSandbox('connect', {data: 'from host'})

            await expect(host).resolves.toEqual({data: 'from host'})
            await waitForSandboxConnection()
        })

        it('should unmarshal function from host context', async () => {
            connectSandbox('connect', {
                func: {
                    _solstice_function_id: 'func-id'
                }
            })

            let host = await _instance.host()

            expect(typeof host.func).toEqual('function')
            await waitForSandboxConnection()
        })

        it('should unmarshal function nested in host context', async () => {
            connectSandbox('connect', {
                data: {
                    func: {
                        _solstice_function_id: 'func-id'
                    }
                }
            })

            let host = await _instance.host()

            expect(typeof host.data.func).toEqual('function')
            await waitForSandboxConnection()
        })

        it('should call function from host context', async () => {
            vi.mocked(v4).mockReturnValueOnce('function-call-id')

            connectSandbox('connect', {
                func: {
                    _solstice_function_id: 'func-id'
                }
            })

            _instance.host().then(host => host.func())

            await expect(waitForSandboxConnection()
                .then(_ => waitForRequest())).resolves.toEqual({
                id: 'function-call-id',
                type: 'call',
                function: 'func-id'
            })
        })

        it('should response function call', async () => {
            vi.mocked(v4).mockReturnValueOnce('function-call-id')

            connectSandbox('connect', {
                func: {
                    _solstice_function_id: 'func-id'
                }
            })

            let result = _instance.host().then(host => host.func())

            await waitForSandboxConnection().then(_ => waitForRequest())

            returnFunction('function-call-id', 'return from host')

            await expect(result).resolves.toEqual('return from host')
        })
    })

    describe('call callback function in sandbox context', () => {
        beforeEach(() => {
            vi.mocked(v4).mockReturnValueOnce('callback-id')
        })

        it('should return callback reference in context', async () => {
            sandbox(anyFunction)

            let response = waitForSandboxConnection()

            connectSandbox('connect')

            await expect(response).resolves.toEqual({
                id: 'connect',
                response: {func: {_solstice_callback_id: 'callback-id'}}
            })
        })

        it('should be able to call by callback reference', async () => {
            vi.mocked(v4).mockReturnValueOnce('another')

            let callback = new Promise<any>((resolve) => {
                sandbox({
                    func: () => resolve('func called'),
                    another: () => resolve('another called')
                })
            })

            waitForSandboxConnection().then(e => call('call', e.response.func._solstice_callback_id))
            connectSandbox('connect')

            await expect(callback).resolves.toEqual('func called')
        })

        it('should be able to call callback within other object', async () => {
            let callback = new Promise<any>((resolve) => {
                sandbox({
                    data: {
                        func: () => resolve('func called'),
                    }
                })
            })

            waitForSandboxConnection().then(e => call('call', e.response.data.func._solstice_callback_id))
            connectSandbox('connect')

            await expect(callback).resolves.toEqual('func called')
        })

        it('should not call callback if callback id inexist', async () => {
            sandbox(anyFunction)

            let response = waitForSandboxConnection().then(_ => call('call', 'inexist-callback-id'))
                .then(_ => waitForSandboxResponse())

            connectSandbox('connect')

            await expect(response).resolves.toEqual({id: 'call', error: {message: 'callback not found'}})
        })

        it('should not call callback if sandbox not connected', async () => {
            sandbox(anyFunction)

            let response = waitForSandboxResponse()
            call('call', 'callback-id')

            await expect(response).resolves.toEqual({id: 'call', error: {message: 'not connected'}})
        })

        it('should not call callback if request not from connected target', async () => {
            let source = vi.fn()

            let _unknown = window.document.createElement('iframe')
            window.document.body.appendChild(_unknown)

            sandbox(anyFunction, source)

            source.mockReturnValueOnce(window)
            source.mockReturnValueOnce(_unknown.contentWindow!)

            let response = waitForSandboxConnection().then(_ => call('call', 'callback-id'))
                .then(_ => waitForSandboxResponse(_unknown.contentWindow!))

            connectSandbox('connect')

            await expect(response).resolves.toEqual({id: 'call', error: {message: 'not allowed'}})
        })
    })

    function sandbox(context: any, source: (e: MessageEvent) => Window = _ => window) {
        return new Sandbox({
            sandbox: _sandbox.contentWindow!,
            context: context,
            source: source
        })
    }

    function connectSandbox(id: string, context: any = {}) {
        _sandbox.contentWindow!.postMessage({id: id, type: 'context', context: context}, '*')
    }

    function call(id: string, callback: string) {
        _sandbox.contentWindow!.postMessage({id: id, type: 'call', callback: callback}, '*')
    }

    function returnFunction(id: string, result: any) {
        _sandbox.contentWindow!.postMessage({id: id, type: 'result', result: result}, '*')
    }

    function waitForSandboxResponse(target: Window = window) {
        return new Promise<any>((resolve) => {
            target.addEventListener('message', (e) => resolve(e.data), {once: true})
        })
    }

    const waitForSandboxConnection = waitForSandboxResponse
    const waitForRequest = waitForSandboxResponse

    const anyFunction = {
        func: () => {
        }
    }

    type Error = {
        message: string
    }
})