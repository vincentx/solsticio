import {isPlugin, Plugin} from './runtime'
import {Configuration, Host} from './iframe/sandbox'
import {ErrorCollector} from "./error";

export class Registry {
    private readonly _plugins: Map<string, Plugin> = new Map()
    private readonly _host: Host
    private readonly _errors: ErrorCollector

    constructor(config: Configuration) {
        this._host = new Host(config)
        this._errors = config.errors!
    }

    plugin(plugin: Plugin) {
        if (this._plugins.has(plugin.id)) this._errors.error(plugin.id, 'already registered')
        else this._plugins.set(plugin.id, plugin)
    }

    plugins() {
        return [...this._plugins.values()]
    }

    sandbox(id: string, sandbox: Window) {
        return this._host.connect(id, sandbox).then(context => {
            if (isPlugin(context)) {
                let plugin = context as Plugin
                if (plugin.id !== id) this._errors.error('sandbox', plugin.id, 'can not be registered as', id)
                else this.plugin(plugin)
            } else this._errors.error('sandbox', id, 'is not a plugin')
        })
    }
}