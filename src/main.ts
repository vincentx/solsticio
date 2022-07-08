import {Plugin, Runtime} from './core/runtime'
import {ErrorCollector} from './core/error'
import {Registry} from './core/registry'
import {Sandbox} from './iframe/sandbox'

export namespace Solstice {

    export function plugin(descriptor: Plugin) {
        return new Sandbox({
            container: window,
            context: descriptor,
            source: e => e.source as Window,
            errors: new ErrorCollector(console.log)
        })
    }

    export async function runtime(api: any, register: (registry: Registry) => void) {
        let errorCollector = new ErrorCollector(console.log)
        let registry = new Registry({
            container: window,
            context: api,
            source: e => e.source as Window,
            errors: errorCollector
        }, errorCollector)
        await register(registry)
        return new Runtime(errorCollector, ...registry.plugins())
    }
}