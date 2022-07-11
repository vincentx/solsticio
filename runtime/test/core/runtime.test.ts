import {beforeEach, describe, expect, it} from 'vitest'
import Runtime, {Extension} from '../../src/core/runtime'
import Collector from "../../src/error";

describe('Solstice runtime', () => {
    let _errors: string[]
    let _runtime: Runtime

    beforeEach(() => {
        _errors = []
        _runtime = new Runtime(new Collector(e => _errors.push(e)))
    })

    describe('Extension Points', () => {
        it('should not have any extension points when runtime created', () => {
            expect(_runtime.extensionPoints()).toEqual([])
        })

        it('should install extension points from plugin', () => {
            _runtime.define({
                id: '@core',
                extensionPoints: [{
                    name: 'buttons',
                    validate: (extension: {}) => extension != null
                }]
            })

            expect(_runtime.extensionPoints()).toEqual(['@core/buttons'])
        })

        it('should collect error if extension point already defined', () => {
            _runtime.define({
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

        it('should collect error if plugin with duplicate id while register extension points', () => {
            _runtime.define({id: '@core', extensionPoints: []}, {id: '@core', extensionPoints: []})

            expect(_errors).toEqual(['plugin @core : @core already installed'])
        })
    })

    describe('Extension', () => {
        it('should return empty extensions for undefined extension points', () => {
            expect(_runtime.extensions('@core/undefined')).toEqual([])
        })

        it('should install extensions from plugin', () => {
            _runtime.define({
                id: '@core',
                extensionPoints: [{
                    name: 'buttons',
                    validate: (extension: {}) => extension != null
                }]
            })

            _runtime.install({
                id: '@buttons',
                extensions: [{
                    name: 'red-button',
                    extensionPoint: '@core/buttons'
                }]
            })

            expect(_runtime.extensions('@core/buttons')).toEqual([{
                id: '@buttons/red-button',
                name: 'red-button',
                extensionPoint: '@core/buttons'
            }])
        })

        it('should not install extension if extension points undefined', () => {
            _runtime.install({
                id: '@extension',
                extensions: [{
                    name: 'red-button',
                    extensionPoint: '@core/buttons'
                }]
            })
            expect(_runtime.extensions('@core/buttons')).toEqual([])
            expect(_errors).toEqual(['plugin @extension : extension point @core/buttons not found for @extension/red-button'])
        })

        it('should collect error if extension not valid', () => {
            _runtime.define(
                {
                    id: '@core',
                    extensionPoints: [{
                        name: 'buttons',
                        validate: () => false
                    }]
                })
            _runtime.install({
                id: '@buttons',
                extensions: [{
                    name: 'red-button',
                    extensionPoint: '@core/buttons'
                }]
            })

            expect(_errors).toEqual(['plugin @buttons : @buttons/red-button not valid for @core/buttons'])
        })

        it('should collect error if extension point validation throws error', () => {
            _runtime.define({
                id: '@core',
                extensionPoints: [{
                    name: 'buttons',
                    validate: () => {
                        throw 'error'
                    }
                }]
            });

            _runtime.install({
                id: '@buttons',
                extensions: [{
                    name: 'red-button',
                    extensionPoint: '@core/buttons'
                }]
            })

            expect(_errors).toEqual(['plugin @buttons : @buttons/red-button not valid for @core/buttons : error'])
        })

        it('should collect error if plugin with duplicate id while register extension points', () => {
            _runtime.install({id: '@core', extensions: []}, {id: '@core', extensions: []})

            expect(_errors).toEqual(['plugin @core : @core already installed'])
        })
    })

    describe('Extension Point watcher', () => {
        it('should notify watcher when new extension installed', () => {
            _runtime.define({
                id: '@core',
                extensionPoints: [{
                    name: 'buttons',
                    validate: (extension: {}) => extension != null
                }]
            })

            let extensions = []
            _runtime.watch('@core/buttons', (e: Extension[]) => extensions.push(...e))

            _runtime.install({
                id: '@buttons',
                extensions: [{
                    name: 'red-button',
                    extensionPoint: '@core/buttons'
                }]
            })

            expect(extensions).toEqual([{
                id: "@buttons/red-button",
                name: 'red-button',
                extensionPoint: '@core/buttons'
            }])
        })

        it('should record error occurred in watch method and not affect other watchers', () => {
            _runtime.define({
                id: '@core',
                extensionPoints: [{
                    name: 'buttons',
                    validate: (extension: {}) => extension != null
                }]
            })

            _runtime.watch('@core/buttons', (e: Extension[]) => {
                throw 'error'
            })
            let extensions = []
            _runtime.watch('@core/buttons', (e: Extension[]) => extensions.push(...e))


            _runtime.install({
                id: '@buttons',
                extensions: [{
                    name: 'red-button',
                    extensionPoint: '@core/buttons'
                }]
            })
            expect(_errors).toEqual(['error'])
            expect(extensions).toEqual([{
                id: "@buttons/red-button",
                name: 'red-button',
                extensionPoint: '@core/buttons'
            }])
        })

        it('should not longer be notified after unwatch', () => {
            _runtime.define({
                id: '@core',
                extensionPoints: [{
                    name: 'buttons',
                    validate: (extension: {}) => extension != null
                }]
            })

            let extensions = []
            let watcher = (e: Extension[]) => extensions.push(...e)
            _runtime.watch('@core/buttons', watcher)
            _runtime.unwatch('@core/buttons', watcher)

            _runtime.install({
                id: '@buttons',
                extensions: [{
                    name: 'red-button',
                    extensionPoint: '@core/buttons'
                }]
            })
            expect(extensions).toEqual([])
        })
    })
})