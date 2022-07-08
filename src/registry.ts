import {Plugin} from './runtime'
import {Host, Configuration} from './iframe/sandbox'

export class Registry {
    private _plugins: Map<string, Plugin> = new Map()
    private _host: Host

    constructor(config: Configuration) {
        this._host = new Host(config)
    }

    plugin(plugin: Plugin) {
        this._plugins.set(plugin.id, plugin)
    }

    plugins() {
        return [...this._plugins.values()]
    }

    sandbox(id: string, sandbox: Window) {
        return this._host.connect(id, sandbox).then(context => {
            let plugin = context as Plugin
            this._plugins.set(plugin.id, plugin)
        })
    }
}