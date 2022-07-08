import {Registry} from './core/registry'
import {ErrorCollector} from './core/error'
import {Runtime} from './core/runtime'

export namespace Solstice {
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