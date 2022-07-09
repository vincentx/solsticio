import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'
import {Callable, CallableRequest, Local} from '../../src/iframe/communication'
import {v4} from 'uuid'

describe('iFrame communication: Local', () => {
    beforeEach(() => {
        vi.mock('uuid', () => {
            return {
                v4: vi.fn()
            }
        })
    })

    describe('export context to remote', () => {
        beforeEach(() => {
            vi.mocked(v4).mockReturnValueOnce('function-id')
        })

        afterEach(() => {
            vi.restoreAllMocks()
        })

        it('should export context object to remote', () => {
            let local = new Local({data: 'data'})
            expect(local.toRemote()).toEqual({data: 'data'})
        })

        it('should export nested object to remote', () => {
            let local = new Local({data: {nested: 'nested'}})
            expect(local.toRemote()).toEqual({data: {nested: 'nested'}})
        })

        it('should export array to remote', () => {
            let local = new Local({array: [1, 2, 3]})
            expect(local.toRemote()).toEqual({array: [1, 2, 3]})
        })

        it('should export function as callable', () => {
            let local = new Local({
                func: () => {
                }
            })

            expect(local.toRemote()).toEqual({func: {_solstice_id: 'function-id'}})
        })

        it('should export function in nested object as callable', () => {
            let local = new Local({
                nested: {
                    func: () => {
                    }
                }
            })

            expect(local.toRemote()).toEqual({nested: {func: {_solstice_id: 'function-id'}}})
        })
    })

    describe('receive call from remote', () => {
        beforeEach(() => {
            vi.mocked(v4).mockReturnValueOnce('first')
            vi.mocked(v4).mockReturnValueOnce('second')
        })

        it('should call function on context after receive request from remote', () => {
            let local = new Local({
                func: (parameter: any) => parameter,
                nested: {
                    func: (parameter: any) => parameter
                }
            })

            let remote = local.toRemote()

            expect(local.receive(request(remote.func, 'func called'), _ => _)).toEqual('func called')
            expect(local.receive(request(remote.nested.func, 'nested func called'), _ => _)).toEqual('nested func called')
        })

        it('should call function on context with parameter', () => {
            let local = new Local({
                func: (parameter: any) => parameter
            })

            let remote = local.toRemote()

            expect(local.receive(request(remote.func, 'string'), _ => 'remote')).toEqual('remote')
        })

        it('should throw exception if unknown function required', () => {
            let local = new Local({
                func: () => 'func called',
            })

            expect(() => local.receive(request({_solstice_id: 'unknown'}), _ => _)).toThrowError('unknown callable')
        })
    })

    function request(callable: Callable, ...parameters: any[]): CallableRequest {
        return {id: 'message-id', type: 'call', callable: callable._solstice_id, parameters: parameters}
    }
})