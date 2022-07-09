import {v4 as uuid} from 'uuid'

export type Context = any
export type Callable = { _solstice_id: string }
export type CallableRequest = { id: string, type: 'call', callable: string, parameters: any[] }
export type CallableResponse = { id: string, type: 'response', response: any }

type Receiver = (value: any) => void
type UUID = string

export class Remote {
    private readonly _receivers: Map<UUID, Receiver> = new Map()

    //TODO append prefix to avoid conflict

    receive(response: CallableResponse) {
        if (!this._receivers.has(response.id)) throw 'callable not called'
        this._receivers.get(response.id)!(response.response)
        this._receivers.delete(response.id)
    }

    send(remote: Window, message: (id: string) => any) {
        return new Promise<any>((resolve) => {
            let id = uuid()
            this._receivers.set(id, resolve)
            remote.postMessage(message(id), '*')
        })
    }

    fromRemote(context: Context, local: Local, remote: Window): Context {
        if (context._solstice_id) return this.createCallable(context, local, remote)
        if (Array.isArray(context)) return context.map(v => this.fromRemote(v, local, remote))
        if (typeof context === 'object') {
            let result: any = {}
            for (let key of Object.keys(context))
                result[key] = this.fromRemote(context[key], local, remote)
            return result
        }
        return context
    }

    private createCallable(callable: Callable, local: Local, remote: Window) {
        let call = this.send.bind(this)
        return function (): Promise<any> {
            let parameters = local.toRemote([...arguments])
            return call(remote, (id) => {
                return {id: id, type: 'call', callable: callable._solstice_id, parameters: parameters}
            })
        }
    }
}

export class Local {
    private readonly _callables: Map<UUID, Function> = new Map()
    private readonly _uuid: () => UUID;

    constructor(gen: () => UUID = uuid ) {
        this._uuid = gen;
    }

    receive(request: CallableRequest, fromRemote: (parameter: any) => any) {
        return this.call(request.callable, ...request.parameters.map(fromRemote))
    }

    call(id: UUID, ...parameters: any[]) {
        if (!this._callables.has(id)) throw 'unknown callable'
        return this._callables.get(id)!(...parameters)
    }

    toRemote(object: any): any {
        if (Array.isArray(object)) return object.map(v => this.toRemote(v))
        if (typeof object === 'function') return this.toRemoteCallable(object)
        if (typeof object === 'object') {
            let result: any = {}
            for (let key of Object.keys(object))
                result[key] = this.toRemote(object[key])
            return result
        }
        return object
    }

    private toRemoteCallable(func: Function): Callable {
        let id = this._uuid()
        this._callables.set(id, func)
        return {_solstice_id: id}
    }
}
