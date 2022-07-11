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

export function isExtensions(context: any): context is Extensions {
    return context && context.id && context.extensions && Array.isArray(context.extensions)
        && context.extensions.every((e: any) => e.name && e.extensionPoint)
}

export default class Runtime {
    protected readonly _errors: Collector

    private readonly _plugins: Map<Identifier, Plugin> = new Map()
    private readonly _extensionPoints: Map<Identifier, ExtensionPoint<any>> = new Map()
    private readonly _extensions: Map<Identifier, Extension[]> = new Map()

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

    define(...extensionPoints: ExtensionPoints[]) {
        for (let plugin of extensionPoints)
            if (!this._plugins.has(plugin.id)) {
                this._plugins.set(plugin.id, plugin)
                plugin.extensionPoints.forEach(point => this.installExtensionPoint(plugin, point))
            } else this.error(plugin, plugin.id, 'already installed')
        return this
    }

    install(...extensions: Extensions[]) {
        for (let plugin of extensions) {
            if (!this._plugins.has(plugin.id)) {
                this._plugins.set(plugin.id, plugin)
                plugin.extensions.forEach(extension => this.installExtension(plugin, extension))
            } else this.error(plugin, plugin.id, 'already installed')
        }
        return this
    }

    private installExtensionPoint(plugin: ExtensionPoints, extensionPoint: ExtensionPoint<Extension>) {
        let id = identifier(plugin, extensionPoint)
        if (this._extensionPoints.has(id))
            this.error(plugin, 'extension point', id, 'already defined')
        else this.registerExtensionPoint(id, extensionPoint)
    }

    private installExtension(plugin: Extensions, extension: Extension) {
        let id = identifier(plugin, extension)
        if (!this._extensions.has(extension.extensionPoint))
            this.error(plugin, 'extension point', extension.extensionPoint, 'not found for', id)
        else this.registerExtension(id, extension, plugin)
    }

    private error(plugin: Plugin, ...message: any[]) {
        this._errors.collect('plugin', plugin.id, ':', ...message)
    }

    private registerExtensionPoint(id: Identifier, extensionPoint: ExtensionPoint<Extension>) {
        this._extensionPoints.set(id, extensionPoint)
        this._extensions.set(id, [])
    }

    private registerExtension(id: Identifier, extension: Extension, plugin: Plugin) {
        let extensionPoint = this._extensionPoints.get(extension.extensionPoint)!;
        try {
            if (extensionPoint.validate && !extensionPoint.validate(extension)) this.error(plugin, id, 'not valid for', extension.extensionPoint)
            else this._extensions.get(extension.extensionPoint)!.push({...{id: id}, ...extension})
        } catch (e) {
            this.error(plugin, id, 'not valid for', extension.extensionPoint, ':', e)
        }
    }
}

function identifier(plugin: Plugin, component: ExtensionPoint<Extension> | Extension) {
    return [plugin.id, component.name].join('/')
}

