import {Plugin} from './core/runtime'

import Collector from './error'
import SandboxRuntime from './core/sandbox-runtime'
import {Sandbox} from './iframe/sandbox'

const Solstice = {
    plugin(descriptor: Plugin, hostOrigin: string, log: (...messages: any[]) => void = (_) => _) {
        return new Sandbox({
            container: window,
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

export default Solstice
