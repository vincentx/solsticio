import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'
import {Local} from '../../src/iframe/duplex'

describe('Duplex Callable: Local Remote Callables', () => {
    let _local: Local

    describe('export context to remote', () => {
        beforeEach(() => {
            _local = new Local(() => 'function-id')
        })

        afterEach(() => {
            vi.unmock('uuid')
        })

        it('should export context object to remote', () => {
            expect(_local.toRemote({data: 'data'})).toEqual({data: 'data'})
        })

        it('should export nested object to remote', () => {
            expect(_local.toRemote({data: {nested: 'nested'}})).toEqual({data: {nested: 'nested'}})
        })

        it('should export array to remote', () => {
            expect(_local.toRemote({array: [1, 2, 3]})).toEqual({array: [1, 2, 3]})
        })

        it('should export function as callable', () => {
            expect(_local.toRemote({
                func: () => {
                }
            })).toEqual({func: {_solstice_id: 'function-id'}})
        })

        it('should export function in nested object as callable', () => {
            expect(_local.toRemote({
                nested: {
                    func: () => {
                    }
                }
            })).toEqual({nested: {func: {_solstice_id: 'function-id'}}})
        })
    })

    describe('call function by id', () => {
        beforeEach(() => {
            _local = new Local()
        })

        it('should call function without parameter', () => {
            let remote = _local.toRemote({
                func: () => 'called',
            })

            expect(_local.call(remote.func._solstice_id)).toEqual('called')
        })

        it('should call function with parameter', () => {
            let remote = _local.toRemote({
                func: (parameter: any) => parameter,
            })

            expect(_local.call(remote.func._solstice_id, 'parameter')).toEqual('parameter')
        })

        it('should export function call result to remote', () => {
            let local = new Local(() => 'function-id')

            let remote = local.toRemote({
                func: () => () => 'function',
            })

            expect(local.call(remote.func._solstice_id)).toEqual({_solstice_id: 'function-id'})
        })

        it('should throw exception if unknown function required', () => {
            expect(() => _local.call('unknown')).toThrowError('unknown callable')
        })
    })

    describe('export special named function to remote', () => {
        beforeEach(() => {
            _local = new Local(() => 'function-id')
        })

        it('should export special named functions if name not taken', () => {
            _local.named(new Map([['$context', () => '$context']]))

            expect(_local.call('$context')).toEqual('$context')
        })

        it('should not export special named if name already taken', () => {
            _local.toRemote({
                func: () => 'taken'
            })

            _local.named(new Map([['function-id', () => 'function-id']]))

            expect(_local.call('function-id')).toEqual('taken')
        })
    })
})