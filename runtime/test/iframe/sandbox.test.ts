import {beforeEach, describe, expect, it, vi} from 'vitest'
import {Sandbox} from '../../src/iframe/sandbox'
import {ErrorCollector} from '../../src/core/error'
import * as Duplex from '../../src/iframe/duplex'

describe('Sandbox', () => {
    let _errors: string[]
    let _container: any

    let _handler
    let _sandbox: Sandbox
    let _hostOrigin: string = 'https://host.com'

    beforeEach(() => {
        _container = {
            addEventListener: vi.fn(),
            postMessage: vi.fn()
        }
        _errors = []
    })

    describe('connect remote host', () => {
        beforeEach(() => {
            _sandbox = sandbox({context: 'sandbox'})
            _handler = _container.addEventListener.mock.lastCall[1]
        })

        it('should expose local context to remote host', () => {
            _handler(connectSandbox())

            expect(_container.postMessage).toHaveBeenCalledWith({
                id: 'connect-id',
                type: 'response',
                response: {context: 'sandbox'}
            }, _hostOrigin)
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

            _sandbox = sandbox({context: 'sandbox'})
            _handler = _container.addEventListener.mock.lastCall[1]
        })

        it('should handle call request from host origin', () => {
            _handler(connectSandbox())

            _handler({
                data: {id: 'request-id', type: 'call', callable: 'function-id', parameters: []},
                source: _container,
                origin: _hostOrigin
            })

            expect(_duplex.handle.mock.lastCall[1]).toEqual({
                id: 'request-id',
                type: 'call',
                callable: 'function-id',
                parameters: []
            })
        })

        it('should handle call response from host origin', () => {
            _handler(connectSandbox())

            _handler({
                data: {id: 'request-id', type: 'response', response: 'response'},
                source: _container,
                origin: _hostOrigin
            })

            expect(_duplex.handle.mock.lastCall[1]).toEqual({id: 'request-id', type: 'response', response: 'response'})
        })

        it('should not handle any message not from host origin', () => {
            _handler({
                data: {id: 'request-id', type: 'response', response: 'response'},
                source: _container,
                origin: 'https://somewhere.else'
            })

            expect(_duplex.handle).toHaveBeenCalledTimes(0)
            expect(_container.postMessage).toHaveBeenCalledTimes(0)
        })

        it('should collect error if error received', () => {
            _handler({
                data: {id: 'error-id', type: 'error', error: {message: 'reason'}},
                origin: _hostOrigin
            })

            expect(_errors).toEqual(['reason'])
        })

        it('should not handle if not a sandbox request', () => {
            let source = {
                postMessage: vi.fn()
            }
            _handler({
                data: 'something', source,
                origin: _hostOrigin
            })
            expect(_duplex.handle).toHaveBeenCalledTimes(0)
            expect(_container.postMessage).toHaveBeenCalledTimes(0)
            expect(source.postMessage).toHaveBeenCalledTimes(0)
        })
    })

    function sandbox(context: any = {}) {
        return new Sandbox({
            container: _container!,
            context: context,
            log: silence,
            errors: new ErrorCollector((e) => _errors.push(e))
        }, _hostOrigin)
    }

    function connectSandbox(id: string = 'connect-id', context: any = {}) {
        return {
            data: {
                id: id,
                type: 'call',
                callable: '_solstice_connect_sandbox',
                parameters: [context]
            },
            source: _container,
            origin: _hostOrigin
        }
    }

    function silence(...messages: any[]) {
    }
})
