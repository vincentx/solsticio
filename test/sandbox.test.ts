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

            await expect(response).resolves.toEqual({id: 'connect', type: 'response', response: {data: 'context'}})
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
        it('should access host context', async () => {
            let host = sandbox({data: 'context'}).host()
            connectSandbox('connect', {data: 'from host'})

            await expect(host).resolves.toEqual({data: 'from host'})
            await waitForSandboxConnection()
        })

        it('should unmarshal function from host context', async () => {
            let instance = sandbox({data: 'context'})
            connectSandbox('connect', {
                func: {
                    _solstice_id: 'func-id'
                }
            })

            let host = await instance.host()

            expect(typeof host.func).toEqual('function')
            await waitForSandboxConnection()
        })

        it('should unmarshal function nested in host context', async () => {
            let instance = sandbox({data: 'context'})
            connectSandbox('connect', {
                data: {
                    func: {
                        _solstice_id: 'func-id'
                    }
                }
            })

            let host = await instance.host()

            expect(typeof host.data.func).toEqual('function')
            await waitForSandboxConnection()
        })

        it('should call function from host context', async () => {
            vi.mocked(v4).mockReturnValueOnce('function-call-id')

            let instance = sandbox({data: 'context'})

            connectSandbox('connect', {
                func: {
                    _solstice_id: 'func-id'
                }
            })

            instance.host().then(host => host.func())

            await expect(waitForSandboxConnection()
                .then(_ => waitForRequest())).resolves.toEqual({
                id: 'function-call-id',
                type: 'call',
                callable: 'func-id'
            })
        })

        it('should response function call', async () => {
            vi.mocked(v4).mockReturnValueOnce('function-call-id')

            let instance = sandbox({data: 'context'})

            connectSandbox('connect', {
                func: {
                    _solstice_id: 'func-id'
                }
            })

            let result = instance.host().then(host => host.func())

            await waitForSandboxConnection().then(_ => waitForRequest())

            returnFunction('function-call-id', 'return from host')

            await expect(result).resolves.toEqual('return from host')
        })

        it('should not response to function return if not connected', async () => {
            sandbox({data: 'context'})
            let response = waitForSandboxResponse()
            returnFunction('function-call-id', 'return result')

            await expect(response).resolves.toEqual({id: 'function-call-id', error: {message: 'not connected'}})
        })

        it('should ignore function return from unknown target', async () => {
            let source = vi.fn()

            let unknown = window.document.createElement('iframe')
            window.document.body.appendChild(unknown)

            sandbox(anyFunction, source)

            source.mockReturnValueOnce(window)
            source.mockReturnValueOnce(unknown.contentWindow!)

            let response = waitForSandboxConnection().then(_ => returnFunction('function-call-id', 'return result'))
                .then(_ => waitForSandboxResponse(unknown.contentWindow!))

            connectSandbox('connect', {
                func: {
                    _solstice_id: 'func-id'
                }
            })

            await expect(response).resolves.toEqual({id: 'function-call-id', error: {message: 'not allowed'}})

        })
        it('should ignore unknown function return', async () => {
            sandbox(anyFunction)

            let response = waitForSandboxConnection().then(_ => returnFunction('function-call-id', 'return result'))
                .then(_ => waitForSandboxResponse())

            connectSandbox('connect')

            await expect(response).resolves.toEqual({id: 'function-call-id', error: {message: 'function not called'}})
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
                type: 'response',
                response: {func: {_solstice_id: 'callback-id'}}
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

            waitForSandboxConnection().then(e => call('call', e.response.func._solstice_id))
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

            waitForSandboxConnection().then(e => call('call', e.response.data.func._solstice_id))
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

            let unknown = window.document.createElement('iframe')
            window.document.body.appendChild(unknown)

            sandbox(anyFunction, source)

            source.mockReturnValueOnce(window)
            source.mockReturnValueOnce(unknown.contentWindow!)

            let response = waitForSandboxConnection().then(_ => call('call', 'callback-id'))
                .then(_ => waitForSandboxResponse(unknown.contentWindow!))

            connectSandbox('connect')

            await expect(response).resolves.toEqual({id: 'call', error: {message: 'not allowed'}})
        })
    })

    function sandbox(context: any, source: (e: MessageEvent) => Window = _ => window) {
        return new Sandbox({
            window: _sandbox.contentWindow!,
            context: context,
            source: source
        })
    }

    function connectSandbox(id: string, context: any = {}) {
        _sandbox.contentWindow!.postMessage({id: id, type: 'context', context: context}, '*')
    }

    function call(id: string, callable: string) {
        _sandbox.contentWindow!.postMessage({id: id, type: 'call', callable: callable}, '*')
    }

    function returnFunction(id: string, result: any) {
        _sandbox.contentWindow!.postMessage({id: id, type: 'response', response: result}, '*')
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