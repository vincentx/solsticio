type Name = string
type Identifier = string

function id(plugin: Plugin, component: ExtensionPoint<Extension> | Extension) {
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

export default class Runtime {
    private _extensionPoints: Map<Identifier, ExtensionPoint<any>> = new Map()
    private _extensions: Map<Identifier, Extension[]> = new Map()

    constructor(...plugins: Plugin[]) {
        for (let plugin of plugins) {
            for (let extensionPoint of plugin.extensionPoints)
                this._extensionPoints.set(id(plugin, extensionPoint), extensionPoint)

            for (let extension of plugin.extensions) {
                if (!this._extensions.has(extension.extensionPoint))
                    this._extensions.set(extension.extensionPoint, [])
                this._extensions.get(extension.extensionPoint)!.push({...{id: id(plugin, extension)}, ...extension})
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
}


