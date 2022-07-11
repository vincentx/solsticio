import ErrorCollector from './error'
import SandboxRuntime from './core/sandbox-runtime'
import {Sandbox} from './iframe/sandbox'
import Runtime, {Extension, ExtensionPoint, Plugin} from './core/runtime'

export {Runtime, SandboxRuntime, ErrorCollector}
export type {Extension, ExtensionPoint}

export default {
    plugin(descriptor: Plugin, hostOrigin: string, log: (...messages: any[]) => void = (_) => _, target?: Window) {
        return new Sandbox({
            container: target || window,
            context: descriptor,
            log: log,
            errors: new ErrorCollector(console.log)
        }, hostOrigin)
    },

    runtime(api: any, log: (...messages: any[]) => void = (_) => _) {
        return new SandboxRuntime({
            container: window,
            context: api,
            errors: new ErrorCollector(console.log),
            log: log
        })
    }
}