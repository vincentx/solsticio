import {ErrorCollector} from './error'

type Name = string
type Identifier = string

function identifier(plugin: Plugin, component: ExtensionPoint<Extension> | Extension) {
    return [plugin.id, component.name].join('/')
}

export type ExtensionPoint<E extends Extension> = {
    readonly name: Name
    validate: (extension: E) => boolean
}

export interface Extension {
    readonly name: Name
    readonly extensionPoint: Identifier
}

export type Plugin = {
    readonly id: Identifier
    extensionPoints?: ExtensionPoint<Extension>[]
    extensions?: Extension[]
}

export function isPlugin(context: any): context is Plugin {
    return context.id
}

export class Runtime {
    private readonly _errors: ErrorCollector

    private readonly _plugins: Map<Identifier, Plugin> = new Map()
    private readonly _extensionPoints: Map<Identifier, ExtensionPoint<any>> = new Map()
    private readonly _extensions: Map<Identifier, Extension[]> = new Map()


    constructor(errors: ErrorCollector, ...plugins: Plugin[]) {
        this._errors = errors
        for (let plugin of plugins)
            if (this._plugins.has(plugin.id)) this.error(plugin, plugin.id, 'already installed')
            else this._plugins.set(plugin.id, plugin)

        for (let plugin of this._plugins.values())
            for (let extensionPoint of plugin.extensionPoints || []) {
                let id = identifier(plugin, extensionPoint)
                if (this._extensionPoints.has(id))
                    this.error(plugin, 'extension point', id, 'already defined')
                else this.registerExtensionPoint(id, extensionPoint)
            }

        for (let plugin of this._plugins.values()) {
            for (let extension of plugin.extensions || []) {
                let id = identifier(plugin, extension)
                if (!this._extensions.has(extension.extensionPoint))
                    this.error(plugin, 'extension point', extension.extensionPoint, 'not found for', id)
                else this.registerExtension(id, extension, plugin)
            }
        }
    }

    extensionPoints(): Identifier[] {
        return [...this._extensionPoints.keys()]
    }

    extensions(id: Identifier): Extension[] {
        if (!this._extensions.has(id)) return []
        return [...this._extensions.get(id)!.map(it => {
            return {...it}
        })]
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
            if (!extensionPoint.validate(extension)) this.error(plugin, id, 'not valid for', extension.extensionPoint)
            else this._extensions.get(extension.extensionPoint)!.push({...{id: id}, ...extension})
        } catch (e) {
            this.error(plugin, id, 'not valid for', extension.extensionPoint, ':', e)
        }
    }
}
