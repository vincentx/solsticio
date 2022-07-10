import {isPlugin, Plugin} from './runtime'
import {Configuration, Host} from '../iframe/sandbox'
import {ErrorCollector} from "./error";

export type SandboxPlugin = {
    id: string
    src: string
    window: Window
}

export class Registry {
    private readonly _plugins: Map<string, Plugin> = new Map()
    private readonly _host: Host
    private readonly _errors: ErrorCollector

    constructor(config: Configuration, error: ErrorCollector) {
        this._host = new Host(config)
        this._errors = error
    }

    plugin(plugin: Plugin) {
        if (this._plugins.has(plugin.id)) this._errors.collect(plugin.id, 'already registered')
        else this._plugins.set(plugin.id, plugin)
    }

    plugins() {
        return [...this._plugins.values()]
    }

    sandbox(sandbox: SandboxPlugin) {
        return this._host.connect(sandbox.id, sandbox.window, new URL(sandbox.src).origin).then(context => {
            if (isPlugin(context)) {
                let plugin = context as Plugin
                if (plugin.id !== sandbox.id) this._errors.collect('sandbox', plugin.id, 'can not be registered as', sandbox.id)
                else this.plugin(plugin)
            } else this._errors.collect('sandbox', sandbox.id, 'is not a plugin')
        }, error => this._errors.collect(error))
    }
}