type ExtensionPointIdentifier = string
type PluginIdentifier = string

type ExtensionPoint<Extension> = {
    readonly id: string
    validate: (extension: Extension) => boolean
}

type Plugin = {
    readonly id: PluginIdentifier
    extensionPoints: ExtensionPoint<any>[]
}

export default class Runtime {
    private _extensionPoints: Map<ExtensionPointIdentifier, ExtensionPoint<any>> = new Map()

    extensionPoints(): ExtensionPointIdentifier[] {
        return [...this._extensionPoints.keys()]
    }

    install(plugin: Plugin) {
        for (let extensionPoint of plugin.extensionPoints)
            this._extensionPoints.set([plugin.id, extensionPoint.id].join("/"), extensionPoint)
    }


}


