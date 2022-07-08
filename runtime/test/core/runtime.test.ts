import {beforeEach, describe, expect, it} from 'vitest'
import {Runtime, Plugin} from '../../src/core/runtime'
import {ErrorCollector} from "../../src/core/error";

describe('Solstice runtime', () => {
    let _errors: string[]

    beforeEach(() => {
        _errors = []
    })

    it('should not have any extension points when runtime created', () => {
        const runtime = install()
        expect(runtime.extensionPoints()).toEqual([])
    })

    it('should install extension points from plugin', () => {
        const runtime = install({
            id: '@core',
            extensionPoints: [{
                name: 'buttons',
                validate: (extension: {}) => extension != null
            }]
        })

        expect(runtime.extensionPoints()).toEqual(['@core/buttons'])
    })

    it('should return empty extensions for undefined extension points', () => {
        const runtime = install()
        expect(runtime.extensions('@core/undefined')).toEqual([])
    })

    it('should install extensions from plugin', () => {
        const runtime = install({
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
        const runtime = install({
            id: '@extension',
            extensions: [{
                name: 'red-button',
                extensionPoint: '@core/buttons'
            }]
        })
        expect(runtime.extensions('@core/buttons')).toEqual([])
        expect(_errors).toEqual(['plugin @extension : extension point @core/buttons not found for @extension/red-button'])
    })

    it('should install all extension points before extensions', () => {
        const runtime = install(
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
        install(
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
        expect(_errors).toEqual(['plugin @core : extension point @core/buttons already defined'])
    })

    it('should collect error if extension not valid', () => {
        install(
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

        expect(_errors).toEqual(['plugin @core : @core/red-button not valid for @core/buttons'])
    })

    it('should collect error if extension point throws error', () => {
        install(
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

        expect(_errors).toEqual(['plugin @core : @core/red-button not valid for @core/buttons : error'])
    })

    it('should collect error if plugin with duplicate id', () => {
        install({id: '@core'}, {id: '@core'})

        expect(_errors).toEqual(['plugin @core : @core already installed'])
    })

    function install(...plugins: Plugin[]) {
        return new Runtime(new ErrorCollector(e => _errors.push(e)), ...plugins)
    }
})