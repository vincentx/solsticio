import {beforeEach, describe, expect, it, vi} from 'vitest'
import {Host} from '../../src/iframe/sandbox'
import {ErrorCollector} from '../../src/core/error'
import * as uuid from 'uuid'
import * as Duplex from '../../src/iframe/duplex'

describe('Host', () => {
    let _errors: string[]
    let _container: any

    let _handler
    let _host, _sandbox

    beforeEach(() => {
        _container = {
            addEventListener: vi.fn(),
            postMessage: vi.fn()
        }

        _sandbox = {
            postMessage: vi.fn()
        }

        _errors = []
    })

    describe('connect remote sandbox', () => {
        beforeEach(() => {
            // @ts-ignore
            vi.spyOn(uuid, 'v4').mockImplementation(() => 'message-id')

            _host = host({context: 'host'})
            _handler = _container.addEventListener.mock.lastCall[1]
        })

        it('should return empty context for undefined sandbox', () => {
            expect(_host.sandbox('@undefined')).toEqual({})
        })

        it('should call connect function on remote sandbox', () => {
            _host.connect('@sandbox', _sandbox as Window, 'https://sandbox.com')

            expect(_sandbox.postMessage).toHaveBeenCalledWith({
                id: 'message-id', type: 'call', callable: '_solstice_connect_sandbox', parameters: [{context: 'host'}]
            }, 'https://sandbox.com')
        })

        it('should register remote sandbox to connected sandboxes', async () => {
            let sandbox = _host.connect('@sandbox', _sandbox as Window, 'https://sandbox.com')

            _handler({
                data: {id: 'message-id', type: 'response', response: {context: 'sandbox'}},
                source: _sandbox,
                origin: 'https://sandbox.com'
            })

            await expect(sandbox).resolves.toEqual({context: 'sandbox'})
        })

        it('should register remote sandbox as local version', async () => {
            let sandbox = _host.connect('@sandbox', _sandbox as Window, 'https://sandbox.com')

            _handler({
                data: {id: 'message-id', type: 'response', response: {func: {_solstice_id: 'function-id'}}},
                source: _sandbox,
                origin: 'https://sandbox.com'
            })

            let sandboxContext = (await sandbox)
            sandboxContext.func()

            expect(_sandbox.postMessage).toHaveBeenCalledWith(
                {id: 'message-id', type: 'call', callable: 'function-id', parameters: []}, 'https://sandbox.com')
        })

        it('should not register remote sandbox if id already registered', async () => {
            let first = _host.connect('@sandbox', _sandbox as Window, 'https://sandbox.com')

            _handler({
                data: {id: 'message-id', type: 'response', response: {context: 'sandbox'}},
                source: _sandbox,
                origin: 'https://sandbox.com'
            })

            await first

            let other = {
                postMessage: vi.fn()
            }

            let second = _host.connect('@sandbox', other, 'https://sandbox.com')
            _handler({
                data: {id: 'message-id', type: 'response', response: {context: 'sandbox'}},
                source: other,
                origin: 'https://sandbox.com'
            })

            await expect(second).rejects.toEqual('@sandbox already registered')
        })
    })

    describe('handle host requests', () => {
        let _duplex

        beforeEach(() => {
            _duplex = {
                handle: vi.fn(),
            }

            // @ts-ignore
            vi.spyOn(Duplex, 'DuplexCallable').mockImplementation(() => _duplex)

            _host = host({context: 'host'})
            _handler = _container.addEventListener.mock.lastCall[1]
        })

        describe('connected sandbox', () => {
            beforeEach(() => {
                _host.connect('@sandbox', _sandbox as Window, 'https://sandbox.com')
                _handler({
                    data: {id: 'message-id', type: 'response', response: {context: 'sandbox'}},
                    source: _sandbox,
                    origin: 'https://sandbox.com'
                })
            })

            it('should handle call request', () => {
                _handler({
                    data: {id: 'request-id', type: 'call', callable: 'function-id', parameters: []},
                    source: _sandbox,
                    origin: 'https://sandbox.com'
                })

                expect(_duplex.handle.mock.lastCall[1]).toEqual({
                    id: 'request-id',
                    type: 'call',
                    callable: 'function-id',
                    parameters: []
                })
            })

            it('should handle call response', () => {
                _handler({
                    data: {id: 'request-id', type: 'response', response: 'response'},
                    source: _sandbox,
                    origin: 'https://sandbox.com'
                })

                expect(_duplex.handle.mock.lastCall[1]).toEqual({
                    id: 'request-id',
                    type: 'response',
                    response: 'response'
                })
            })

            it('should collect error if error received', () => {
                _handler({
                    data: {id: 'error-id', type: 'error', error: {message: 'reason'}},
                    source: _sandbox,
                    origin: 'https://sandbox.com'
                })

                expect(_errors).toEqual(['reason'])
            })
        })

        describe('unknown origin', () => {
            it('should not handle call request', () => {
                _handler({
                    data: {id: 'request-id', type: 'call', callable: 'function-id', parameters: []},
                    source: _sandbox,
                    origin: 'https://other.com'
                })

                expect(_duplex.handle).toHaveBeenCalledTimes(0)
                expect(_sandbox.postMessage).toHaveBeenCalledTimes(0)
            })

            it('should not handle call response', () => {
                _handler({
                    data: {id: 'request-id', type: 'response', response: 'response'},
                    source: _sandbox,
                    origin: 'https://other.com'
                })

                expect(_duplex.handle).toHaveBeenCalledTimes(0)
                expect(_sandbox.postMessage).toHaveBeenCalledTimes(0)
            })

            it('should collect error if error received', () => {
                _handler({
                    data: {id: 'error-id', type: 'error', error: {message: 'reason'}},
                    source: _sandbox,
                    origin: 'https://other.com'
                })

                expect(_duplex.handle).toHaveBeenCalledTimes(0)
                expect(_sandbox.postMessage).toHaveBeenCalledTimes(0)
            })
        })


        it('should not handle if not a solstice request', () => {
            let source = {
                postMessage: vi.fn()
            }
            _handler({data: 'something', source})
            expect(_duplex.handle).toHaveBeenCalledTimes(0)
            expect(_container.postMessage).toHaveBeenCalledTimes(0)
            expect(source.postMessage).toHaveBeenCalledTimes(0)
        })
    })

    function host(context: any = {}) {
        return new Host({
            container: _container!,
            context: context,
            errors: new ErrorCollector((e) => _errors.push(e)),
            log: silence,
            event: (e) => ({
                data: e.data,
                source: _sandbox,
                origin: 'https://sandbox.com'
            } as MessageEvent)
        })
    }

    function silence(...messages: any[]) {
    }
})
