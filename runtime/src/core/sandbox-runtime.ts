import Runtime, {Extensions, isExtensions} from './runtime'
import {Configuration, Host} from '../iframe/sandbox'

export default class SandboxRuntime extends Runtime {
    private readonly _host: Host

    constructor(config: Configuration) {
        super(config.errors)
        this._host = new Host(config)
    }
    
    sandbox(id: string, src: string, window: Window) {
        try {
            return this._host.connect(id, window, new URL(src).origin).then(context => {
                if (isExtensions(context)) {
                    let plugin = context as Extensions
                    if (plugin.id !== id) this._errors.collect('sandbox', plugin.id, 'can not be registered as', id)
                    else this.install(plugin)
                } else this._errors.collect('sandbox', id, 'is not an extensions plugin')
            }, _ => _).catch((reason) => this._errors.collect(reason as string))
        } catch (e) {
            this._errors.collect("invalid src")
            return new Promise(resolve => resolve({}))
        }
    }
}