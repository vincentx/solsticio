import {beforeEach, describe, expect, it} from 'vitest'
import {act, renderHook} from '@testing-library/react'
import useExtensionPoint from '../../src/hooks/use-extension-point'
import {Runtime, ErrorCollector} from '@solsticio/runtime'

// @vitest-environment jsdom
describe('useExtensionPoint hook', () => {
    let _runtime: Runtime

    beforeEach(() => {
        _runtime = new Runtime(new ErrorCollector(_ => _))
    })

    it('should return empty array if extension point not exist', () => {
        const {result} = renderHook(() => useExtensionPoint(_runtime, '@core/unknown'))
        expect(result.current).toEqual([])
    })

    it('should return extensions as default value', () => {
        _runtime.define({id: '@core', extensionPoints: [{name: 'buttons'}]})
        _runtime.install({id: '@buttons', extensions: [{name: 'red', extensionPoint: '@core/buttons'}]})

        const {result} = renderHook(() => useExtensionPoint(_runtime, '@core/buttons'))

        expect(result.current).toEqual([{id: '@buttons/red', name: 'red', extensionPoint: '@core/buttons'}])
    })

    it('should update value when plugin installed', () => {
        _runtime.define({id: '@core', extensionPoints: [{name: 'buttons'}]})
        const {result} = renderHook(() => useExtensionPoint(_runtime, '@core/buttons'))

        expect(result.current).toEqual([])

        act(() => {
            _runtime.install({id: '@buttons', extensions: [{name: 'red', extensionPoint: '@core/buttons'}]})
        })

        expect(result.current).toEqual([{id: '@buttons/red', name: 'red', extensionPoint: '@core/buttons'}])
    })

    it('should not receive extensions update after unmount', () => {
        const hook = renderHook(() => useExtensionPoint(_runtime, '@core/buttons'))
        hook.unmount
        act(() => {
            _runtime.install({id: '@buttons', extensions: [{name: 'red', extensionPoint: '@core/buttons'}]})
        })
        expect(hook.result.current).toEqual([])
    })
})