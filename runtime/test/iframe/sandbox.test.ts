import {beforeEach, describe, expect, it, vi} from 'vitest'
import {Sandbox} from '../../src/iframe/sandbox'
import {ErrorCollector} from '../../src/core/error'
import * as Duplex from '../../src/iframe/duplex'

describe('Sandbox', () => {
    let _errors: string[]
    let _container: any

    let _handler
    let _sandbox: Sandbox

    beforeEach(() => {
        _container = {
            addEventListener: vi.fn(),
            postMessage: vi.fn()
        }
        _errors = []
    })

    describe('connect with remote host', () => {
        beforeEach(() => {
            _sandbox = sandbox({data: 'context'})
            _handler = _container.addEventListener.mock.lastCall[1]
        })

        it('should expose local context to remote host', () => {
            _handler(connectSandbox())

            expect(_container.postMessage).toHaveBeenCalledWith({
                id: 'connect-id',
                type: 'response',
                response: {data: 'context'}
            }, '*')
        })

        it('should not connect to another host if already connected', () => {
            _handler(connectSandbox('first-connect'))
            _handler(connectSandbox('second-connect'))

            expect(_container.postMessage).toHaveBeenLastCalledWith({
                id: 'second-connect',
                type: 'error',
                error: {message: 'already connected'}
            }, '*')

        })

        it('should access host context after connection', async () => {
            _handler(connectSandbox('connect-id', {data: 'from host'}))

            await expect(_sandbox.host()).resolves.toEqual({data: 'from host'})
        })
    })

    describe('handle sandbox requests', () => {
        let _duplex

        beforeEach(() => {
            _duplex = {
                handle: vi.fn(),
            }

            // @ts-ignore
            vi.spyOn(Duplex, 'DuplexCallable').mockImplementation(() => _duplex)

            _sandbox = sandbox({data: 'context'})
            _handler = _container.addEventListener.mock.lastCall[1]
        })

        it('should handle call request', () => {
            _handler(connectSandbox())

            _handler({
                data: {id: 'request-id', type: 'call', callable: 'function-id', parameters: []},
                source: _container
            })

            expect(_duplex.handle.mock.lastCall[1]).toEqual({
                id: 'request-id',
                type: 'call',
                callable: 'function-id',
                parameters: []
            })
        })

        it('should handle call response', () => {
            _handler(connectSandbox())

            _handler({
                data: {id: 'request-id', type: 'response', response: 'response'},
                source: _container
            })

            expect(_duplex.handle.mock.lastCall[1]).toEqual({id: 'request-id', type: 'response', response: 'response'})
        })

        it('should not handle call request if not connected',
            notConnected({id: 'request-id', type: 'call', callable: 'function-id', parameters: []}))

        it('should not handle call request if not sent from connected host',
            notAllowed({id: 'request-id', type: 'call', callable: 'function-id', parameters: []}))

        it('should not handle call response if not connected',
            notConnected({id: 'request-id', type: 'response', response: 'response'}))

        it('should not handle call response if not sent from connected host',
            notAllowed({id: 'request-id', type: 'response', response: 'response'}))

        it('should collect error if error received', () => {
            _handler({data: {id: 'error-id', type: 'error', error: {message: 'reason'}}})

            expect(_errors).toEqual(['reason'])
        })

        it('should not handle if not a sandbox request', () => {
            let source = {
                postMessage: vi.fn()
            }
            _handler({data: 'something', source})
            expect(_duplex.handle).toHaveBeenCalledTimes(0)
            expect(_container.postMessage).toHaveBeenCalledTimes(0)
            expect(source.postMessage).toHaveBeenCalledTimes(0)
        })

        function notConnected(message: any) {
            return function () {
                _handler({
                    data: message,
                    source: _container
                })

                expect(_duplex.handle).toBeCalledTimes(0)
                expect(_container.postMessage).toHaveBeenLastCalledWith({
                    id: 'request-id',
                    type: 'error',
                    error: {message: 'not connected'}
                }, '*')
            }
        }

        function notAllowed(message: any) {
            return function () {
                let source = {
                    postMessage: vi.fn()
                }

                _handler(connectSandbox())

                _handler({
                    data: message,
                    source: source
                })

                expect(source.postMessage).toHaveBeenLastCalledWith({
                    id: 'request-id',
                    type: 'error',
                    error: {message: 'not allowed'}
                }, '*')
            }
        }
    })

    function sandbox(context: any = {},) {
        return new Sandbox({
            container: _container!,
            context: context,
            source: (e) => e.source as Window,
            errors: new ErrorCollector((e) => _errors.push(e))
        })
    }

    function connectSandbox(id: string = 'connect-id', context: any = {}) {
        return {
            data: {
                id: id,
                type: 'call',
                callable: '_solstice_connect_sandbox',
                parameters: [context]
            },
            source: _container
        }
    }
})