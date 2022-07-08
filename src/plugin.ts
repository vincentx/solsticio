import {Plugin} from './core/runtime'
import {Sandbox} from './iframe/sandbox'
import {ErrorCollector} from './core/error'

export namespace Solstice {
    export function plugin(descriptor: Plugin) {
        return new Sandbox({
            container: window,
            context: descriptor,
            source: e => e.source as Window,
            errors: new ErrorCollector(console.log)
        })
    }
}