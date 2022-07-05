import {describe, expect, it} from 'vitest'
import Runtime from '../src/runtime'

describe('Solstice runtime', () => {
    it('should not have any extension points when runtime created', () => {
        const runtime = new Runtime()
        expect(runtime.extensionPoints()).toEqual([])
    })

    it('should install extension points from plugin', () => {
        const runtime = new Runtime({
            id: '@core',
            extensionPoints: [{
                name: 'buttons',
                validate: (extension: {}) => extension != null
            }]
        })

        expect(runtime.extensionPoints()).toEqual(['@core/buttons'])
    })

    it('should return empty extensions for undefined extension points', () => {
        const runtime = new Runtime()
        expect(runtime.extensions('@core/undefined')).toEqual([])
    })

    it('should install extensions from plugin', () => {
        const runtime = new Runtime({
            id: '@core',
            extensionPoints: [{
                name: 'buttons',
                validate: (extension: {}) => extension != null
            }],
            extensions: [{
                name: 'red-button',
                extensionPoint: '@core/buttons'
            }]
        })

        expect(runtime.extensions('@core/buttons')).toEqual([{
            id: '@core/red-button',
            name: 'red-button',
            extensionPoint: '@core/buttons'
        }])
    })

    it('should not install extension if extension points undefined', () => {
        const runtime = new Runtime({
            id: '@extension',
            extensions: [{
                name: 'red-button',
                extensionPoint: '@core/buttons'
            }]
        })
        expect(runtime.extensions('@core/buttons')).toEqual([])
        expect(runtime.errors()).toEqual([{
            id: '@extension',
            message: 'extension point @core/buttons not found for @extension/red-button'
        }])
    })

    it('should install all extension points before extensions', () => {
        const runtime = new Runtime(
            {
                id: '@extension',
                extensions: [{
                    name: 'red-button',
                    extensionPoint: '@core/buttons'
                }]
            }, {
                id: '@core',
                extensionPoints: [{
                    name: 'buttons',
                    validate: (extension: {}) => extension != null
                }]
            }
        )

        expect(runtime.extensions('@core/buttons')).toEqual([{
            id: '@extension/red-button',
            name: 'red-button',
            extensionPoint: '@core/buttons'
        }])
    })

    it('should collect error if extension point already defined', () => {
        const runtime = new Runtime(
            {
                id: '@core',
                extensionPoints: [{
                    name: 'buttons',
                    validate: (extension: {}) => extension != null
                }, {
                    name: 'buttons',
                    validate: (extension: {}) => extension != null
                }]
            }
        )
        expect(runtime.errors()).toEqual([{
            id: '@core',
            message: 'extension point @core/buttons already defined'
        }])
    })

    it('should collect error if extension not valid', () => {
        const runtime = new Runtime(
            {
                id: '@core',
                extensionPoints: [{
                    name: 'buttons',
                    validate: () => false
                }],
                extensions: [{
                    name: 'red-button',
                    extensionPoint: '@core/buttons'
                }]
            }
        )

        expect(runtime.errors()).toEqual([{
            id: '@core',
            message: '@core/red-button not valid for @core/buttons'
        }])
    })

    it('should collect error if extension point throws error', () => {
        const runtime = new Runtime(
            {
                id: '@core',
                extensionPoints: [{
                    name: 'buttons',
                    validate: () => {
                        throw 'error'
                    }
                }],
                extensions: [{
                    name: 'red-button',
                    extensionPoint: '@core/buttons'
                }]
            }
        )

        expect(runtime.errors()).toEqual([{
            id: '@core',
            message: '@core/red-button not valid for @core/buttons : error'
        }])
    })

    it('should collect error if plugin with duplicate id', () => {
        const runtime = new Runtime(
            {id: '@core'}, {id: '@core'}
        )
        expect(runtime.errors()).toEqual([{
            id: '@core',
            message: '@core already installed'
        }])
    })
})