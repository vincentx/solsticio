import {Plugin, PluginError} from './runtime'
import {Host, Configuration} from './iframe/sandbox'

export class Registry {
    private _plugins: Map<string, Plugin> = new Map()
    private _errors: PluginError[] = []
    private _host: Host

    constructor(config: Configuration) {
        this._host = new Host(config)
    }

    plugin(plugin: Plugin) {
        if (this._plugins.has(plugin.id)) this.error(plugin, plugin.id, 'already registered')
        else this._plugins.set(plugin.id, plugin)
    }

    plugins() {
        return [...this._plugins.values()]
    }

    sandbox(id: string, sandbox: Window) {
        return this._host.connect(id, sandbox).then(context => {
            let plugin = context as Plugin
            if (plugin.id !== id) this.error(plugin, 'sandbox id', plugin.id, 'instead of', id)
            else this.plugin(plugin)
        })
    }

    errors() {
        return [...this._errors]
    }

    private error(plugin: Plugin, ...message: any[]) {
        this._errors.push({id: plugin.id, message: message.join(' ')})
    }
}