type Name = string
type Identifier = string

function identifier(plugin: Plugin, component: ExtensionPoint<Extension> | Extension) {
    return [plugin.id, component.name].join("/")
}

type ExtensionPoint<E extends Extension> = {
    readonly name: Name
    validate: (extension: E) => boolean
}

interface Extension {
    readonly name: Name
    readonly extensionPoint: Identifier
}

type Plugin = {
    readonly id: Identifier
    extensionPoints: ExtensionPoint<Extension>[],
    extensions: Extension[]
}

type PluginError = {
    id: Identifier,
    message: string
}

export default class Runtime {
    private _extensionPoints: Map<Identifier, ExtensionPoint<any>> = new Map()
    private _extensions: Map<Identifier, Extension[]> = new Map()
    private _errors: PluginError[] = []

    constructor(...plugins: Plugin[]) {
        for (let plugin of plugins)
            for (let extensionPoint of plugin.extensionPoints) {
                let id = identifier(plugin, extensionPoint)
                this._extensionPoints.set(id, extensionPoint)
                this._extensions.set(id, [])
            }

        for (let plugin of plugins) {
            for (let extension of plugin.extensions) {
                let id = identifier(plugin, extension)
                if (!this._extensions.has(extension.extensionPoint))
                    this.error(plugin, "extension point", extension.extensionPoint, "not found for", id)
                else this._extensions.get(extension.extensionPoint)!.push({...{id: id}, ...extension})
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

    errors(): PluginError[] {
        return [...this._errors]
    }

    private error(plugin: Plugin, ...message: string[]) {
        this._errors.push({id: plugin.id, message: message.join(' ')})
    }
}


