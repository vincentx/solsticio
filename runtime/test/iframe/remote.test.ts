import {beforeEach, describe, expect, it, vi} from 'vitest'
import {Endpoint, Local, Remote} from '../../src/iframe/communication'

describe('Communication: Remote', () => {
    let _remote: Remote
    let _sender: Endpoint

    beforeEach(() => {
        _remote = new Remote(new Local())
        _sender = {
            send: vi.fn()
        }
    })

    describe('restore remote object to local', () => {
        it('should convert remote object to local object', () => {
            let context = _remote.toLocal(_sender, {data: 'data'})
            expect(context).toEqual({data: 'data'})
        })

        it('should convert nested object from remote to local object', () => {
            let context = _remote.toLocal(_sender, {nested: {data: 'data'}})
            expect(context).toEqual({nested: {data: 'data'}})
        })

        it('should convert array from remote to local array', () => {
            let context = _remote.toLocal(_sender, {array: [1, 2, 3]})
            expect(context).toEqual({array: [1, 2, 3]})
        })

        it('should convert undefined to local object', () => {
            let context = _remote.toLocal(_sender, undefined)
            expect(context).toBeUndefined()
        })

        it('should convert function from remote to local function', () => {
            let context = _remote.toLocal(_sender, {func: {_solstice_id: 'func'}})

            context.func('parameter')

            let message: any = vi.mocked(_sender.send).mock.lastCall[0]
            expect(message.type).toEqual('call')
            expect(message.parameters).toEqual(['parameter'])
        })

        it('should convert function nested in object from remote to local function', async () => {
            let context = _remote.toLocal(_sender, {nested: {func: {_solstice_id: 'func'}}})

            context.nested.func('parameter')

            let message: any = vi.mocked(_sender.send).mock.lastCall[0]
            expect(message.type).toEqual('call')
            expect(message.parameters).toEqual(['parameter'])
        })

        it('should convert local function parameter to remote', () => {
            let context = _remote.toLocal(_sender, {func: {_solstice_id: 'func'}})

            context.func(() => 'parameter')

            let message: any = vi.mocked(_sender.send).mock.lastCall[0]
            expect(message.type).toEqual('call')
            expect(message.parameters.length).toEqual(1)
            expect(message.parameters[0]._solstice_id).not.toBe(undefined)
        })
    })

    describe('communicate with remote', () => {
        it('should send message to remote by sender', () => {
            let message: any

            _remote.send(_sender, (id) => {
                message = {id: id, type: 'call', callable: 'callable', parameters: []}
                return message
            })

            expect(_sender.send).toHaveBeenCalledWith(message)
        })

        it('should return remote response to saved promise', async () => {
            let message: any

            let result = _remote.send(_sender, (id) => {
                message = {id: id, type: 'call', callable: 'callable', parameters: []}
                return message
            })

            _remote.receive(_sender, message.id, 'response')

            await expect(result).resolves.toEqual('response')
        })

        it('should convert remote response to local', async () => {
            let message: any

            let result = _remote.send(_sender, (id) => {
                message = {id: id, type: 'call', callable: 'callable', parameters: []}
                return message
            })

            _remote.receive(_sender, message.id, {_solstice_id: 'func'})

            await expect(result).resolves.toBeTypeOf('function')
        })

        it('should throw exception if message id does not match', () => {
            expect(() => _remote.receive(_sender, 'unknown', {})).toThrowError('callable not called')
        })

        it('should not return to sender after response received', () => {
            let message: any

            _remote.send(_sender, (id) => {
                message = {id: id, type: 'call', callable: 'callable', parameters: []}
                return message
            })

            _remote.receive(_sender, message.id, 'response')
            expect(() => _remote.receive(_sender, message.id, 'response')).toThrowError('callable not called')
        })

    })
})