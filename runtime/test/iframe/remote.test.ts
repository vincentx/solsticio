import {beforeEach, describe, expect, it, vi} from 'vitest'
import {Endpoint, Local, Remote} from '../../src/iframe/duplex'

describe('Duplex Callable: Remote Invocations', () => {
    let _remote: Remote
    let _sender: Endpoint

    beforeEach(() => {
        _remote = new Remote(new Local(() => 'function-id'), () => 'message-id')
        _sender = {
            send: vi.fn(),
            call: vi.fn()
        }
    })

    describe('restore remote object to local', () => {
        it('should convert remote object to local object', () => {
            let context = _remote.toLocal_(_sender, {data: 'data'})
            expect(context).toEqual({data: 'data'})
        })

        it('should convert nested object from remote to local object', () => {
            let context = _remote.toLocal_(_sender, {nested: {data: 'data'}})
            expect(context).toEqual({nested: {data: 'data'}})
        })

        it('should convert array from remote to local array', () => {
            let context = _remote.toLocal_(_sender, {array: [1, 2, 3]})
            expect(context).toEqual({array: [1, 2, 3]})
        })

        it('should convert undefined to local object', () => {
            let context = _remote.toLocal_(_sender, undefined)
            expect(context).toBeUndefined()
        })

        it('should convert function from remote to local function', () => {
            let context = _remote.toLocal_(_sender, {func: {_solstice_id: 'func'}})

            context.func('parameter')

            expect(_sender.call).toHaveBeenCalledWith('message-id', 'func', ['parameter'])
        })

        it('should convert function nested in object from remote to local function', async () => {
            let context = _remote.toLocal_(_sender, {nested: {func: {_solstice_id: 'func'}}})

            context.nested.func('parameter')

            expect(_sender.call).toHaveBeenCalledWith('message-id', 'func', ['parameter'])
        })

        it('should convert local function parameter to remote', () => {
            let context = _remote.toLocal_(_sender, {func: {_solstice_id: 'func'}})

            context.func(() => 'parameter')

            expect(_sender.call).toHaveBeenCalledWith('message-id', 'func', [{_solstice_id: 'function-id'}])
        })
    })

    describe('call remote endpoint', () => {
        it('should call remote with parameter', () => {
            _remote.call(_sender, 'func', ['parameter'])

            expect(_sender.call).toHaveBeenCalledWith('message-id', 'func', ['parameter'])
        })

        it('should send result to its caller', async () => {
            let result = _remote.call(_sender, 'func', ['parameter'])

            _remote.receive(_sender, 'message-id', 'response')

            await expect(result).resolves.toEqual('response')
        })

        it('should send local version of the result to its caller', async () => {
            let result = _remote.call(_sender, 'func', ['parameter'])

            _remote.receive(_sender, 'message-id', {_solstice_id: 'func'})

            await expect(result).resolves.toBeTypeOf('function')
        })

        it('should throw exception if message id does not match', () => {
            expect(() => _remote.receive(_sender, 'unknown', {})).toThrowError('callable not called')
        })

        it('should throw exception if message id already used', () => {
            _remote.call(_sender, 'func', ['parameter'])

            _remote.receive(_sender, 'message-id', 'response')

            expect(() => _remote.receive(_sender, 'message-id', 'response')).toThrowError('callable not called')
        })
    })
})