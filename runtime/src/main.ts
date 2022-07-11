import {Plugin, Runtime} from './core/runtime'

import Collector from './error'
import {Registry} from './core/registry'
import {Sandbox} from './iframe/sandbox'

export namespace Solstice {


    export function plugin(descriptor: Plugin, hostOrigin: string, log: (...messages: any[]) => void = (_) => _) {
        return new Sandbox({
            container: window,
            context: descriptor,
            log: log,
            errors: new Collector(console.log)
        }, hostOrigin)
    }

    export async function runtime(api: any, register: (registry: Registry) => void, log: (...messages: any[]) => void = (_) => _) {
        let errorCollector = new Collector(console.log)
        let registry = new Registry({
            container: window,
            context: api,
            errors: errorCollector,
            log: log
        }, errorCollector)
        await register(registry)
        return new Runtime(errorCollector, ...registry.plugins())
    }
}