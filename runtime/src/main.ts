import {Plugin, Runtime} from './core/runtime'
import {ErrorCollector} from './core/error'
import {Registry} from './core/registry'
import {Sandbox} from './iframe/sandbox'

export namespace Solstice {

    export function plugin(descriptor: Plugin, hostOrigin: string, log = silence) {
        return new Sandbox({
            container: window,
            context: descriptor,
            log: log,
            errors: new ErrorCollector(console.log)
        }, hostOrigin)
    }

    export async function runtime(api: any, register: (registry: Registry) => void, log = silence) {
        let errorCollector = new ErrorCollector(console.log)
        let registry = new Registry({
            container: window,
            context: api,
            errors: errorCollector,
            log: log
        }, errorCollector)
        await register(registry)
        return new Runtime(errorCollector, ...registry.plugins())
    }

    function silence(..._: any[]) {
    }
}