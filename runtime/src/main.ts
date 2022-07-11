import {Plugin} from './core/runtime'

import Collector from './error'
import SandboxRuntime from './core/sandbox-runtime'
import {Sandbox} from './iframe/sandbox'

export default {
    plugin(descriptor: Plugin, hostOrigin: string, log: (...messages: any[]) => void = (_) => _, target?: Window) {
        return new Sandbox({
            container: target || window,
            context: descriptor,
            log: log,
            errors: new Collector(console.log)
        }, hostOrigin)
    },

    runtime(api: any, log: (...messages: any[]) => void = (_) => _) {
        return new SandboxRuntime({
            container: window,
            context: api,
            errors: new Collector(console.log),
            log: log
        })
    }
}


