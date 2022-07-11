import Collector from '../error'

type Name = string
type Identifier = string

export type ExtensionPoint<E extends Extension> = {
    readonly name: Name
    validate?: (extension: E) => boolean
}

export interface Extension {
    readonly name: Name
    readonly extensionPoint: Identifier
}

export type Plugin = ExtensionPoints | Extensions

export type ExtensionPoints = {
    readonly id: Identifier
    extensionPoints: ExtensionPoint<Extension>[]
}

export type Extensions = {
    readonly id: Identifier
    extensions: Extension[]
}

export type ExtensionPointWatcher = (extensions: Extension[]) => any

export default class Runtime {
    protected readonly _errors: Collector

    private readonly _plugins: Map<Identifier, Plugin> = new Map()
    private readonly _extensionPoints: Map<Identifier, ExtensionPoint<any>> = new Map()
    private readonly _extensions: Map<Identifier, Extension[]> = new Map()
    private readonly _extensionPointWatchers: Map<Identifier, ExtensionPointWatcher[]> = new Map()

    constructor(errors: Collector) {
        this._errors = errors
    }

    extensionPoints(): Identifier[] {
        return [...this._extensionPoints.keys()]
    }

    extensions(id: Identifier): Extension[] {
        if (!this._extensions.has(id)) return []
        return [...this._extensions.get(id)!.map(it => ({...it}))]
    }

    watch(extensionPoint: Identifier, watcher: ExtensionPointWatcher) {
        if (this._extensionPointWatchers.has(extensionPoint))
            this._extensionPointWatchers.get(extensionPoint)!.push(watcher)
    }

    unwatch(extensionPoint: Identifier, watcher: ExtensionPointWatcher) {
        if (this._extensionPointWatchers.has(extensionPoint)) {
            let watchers = this._extensionPointWatchers.get(extensionPoint)!
            let index = watchers.indexOf(watcher)
            if (index != -1) watchers.splice(index, 1)
        }
    }

    define(...extensionPoints: ExtensionPoints[]) {
        for (let plugin of extensionPoints)
            if (!this._plugins.has(plugin.id)) {
                this._plugins.set(plugin.id, plugin)
                plugin.extensionPoints.forEach(point => this.installExtensionPoint(plugin, point))
            } else this.error(plugin, plugin.id, 'already installed')
        return this
    }

    install(...extensions: Extensions[]) {
        let updated = new Set<Identifier>()
        for (let plugin of extensions) {
            if (!this._plugins.has(plugin.id)) {
                this._plugins.set(plugin.id, plugin)
                plugin.extensions.forEach(extension => this.installExtension(plugin, extension, updated))
            } else this.error(plugin, plugin.id, 'already installed')
        }
        this.notify(updated)
        return this
    }

    private installExtensionPoint(plugin: ExtensionPoints, extensionPoint: ExtensionPoint<Extension>) {
        let id = identifier(plugin, extensionPoint)
        if (this._extensionPoints.has(id))
            this.error(plugin, 'extension point', id, 'already defined')
        else this.registerExtensionPoint(id, extensionPoint)
    }

    private installExtension(plugin: Extensions, extension: Extension, updated: Set<Identifier>) {
        let id = identifier(plugin, extension)
        if (!this._extensions.has(extension.extensionPoint))
            this.error(plugin, 'extension point', extension.extensionPoint, 'not found for', id)
        else this.registerExtension(id, extension, plugin, updated)
    }

    private error(plugin: Plugin, ...message: any[]) {
        this._errors.collect('plugin', plugin.id, ':', ...message)
    }

    private registerExtensionPoint(id: Identifier, extensionPoint: ExtensionPoint<Extension>) {
        this._extensionPoints.set(id, extensionPoint)
        this._extensions.set(id, [])
        this._extensionPointWatchers.set(id, [])
    }

    private registerExtension(id: Identifier, extension: Extension, plugin: Plugin, updated: Set<Identifier>) {
        let extensionPoint = this._extensionPoints.get(extension.extensionPoint)!;
        try {
            if (extensionPoint.validate && !extensionPoint.validate(extension)) this.error(plugin, id, 'not valid for', extension.extensionPoint)
            else {
                this._extensions.get(extension.extensionPoint)!.push({...{id: id}, ...extension})
                updated.add(extension.extensionPoint)
            }
        } catch (e) {
            this.error(plugin, id, 'not valid for', extension.extensionPoint, ':', e)
        }
    }

    private notify(updated: Set<Identifier>) {
        for (let extensionPoint of updated)
            for (let watcher of this._extensionPointWatchers.get(extensionPoint)!)
                try {
                    watcher(this.extensions(extensionPoint))
                } catch (error) {
                    this._errors.collect(error as string)
                }
    }

}

function identifier(plugin: Plugin, component: ExtensionPoint<Extension> | Extension) {
    return [plugin.id, component.name].join('/')
}

