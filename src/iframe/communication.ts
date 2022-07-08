import {v4 as uuid} from 'uuid'


export type Context = any
export type Callable = { _solstice_id: string }
export type CallableRequest = { id: string, type: 'call', callable: string }
export type CallableResponse = { id: string, type: 'response', response: any }

type Receiver = (value: any) => void
type UUID = string

export class Remote {
    private readonly _receivers: Map<UUID, Receiver> = new Map()

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

    fromRemote(context: Context, remote: Window): Context {
        if (context._solstice_id) return this.createCallable(context, remote)
        if (Array.isArray(context)) return context.map(v => this.fromRemote(v, remote))
        if (typeof context === 'object') {
            let result: any = {}
            for (let key of Object.keys(context))
                result[key] = this.fromRemote(context[key], remote)
            return result
        }
        return context
    }

    private createCallable(callable: Callable, remote: Window) {
        let call = this.send.bind(this)
        return function (): Promise<any> {
            return call(remote, (id) => {
                return {id: id, type: 'call', callable: callable._solstice_id}
            })
        }
    }
}

export class Local {
    private readonly _callables: Map<UUID, Function> = new Map()
    private readonly _context: Context;
    private readonly _remote: Context;

    constructor(context: Context) {
        this._context = context;
        this._remote = this.marshal(context)
    }

    toRemote(): Context {
        return this._remote
    }

    receive(request: CallableRequest) {
        if (!this._callables.has(request.callable)) throw 'unknown callable'
        return this._callables.get(request.callable)!.apply(this._context)
    }

    private marshal(context: Context): Context {
        if (Array.isArray(context)) return context.map(v => this.marshal(v))
        if (typeof context === 'function') return this.marshalCallable(context)
        if (typeof context === 'object') {
            let result: any = {}
            for (let key of Object.keys(context))
                result[key] = this.marshal(context[key])
            return result
        }
        return context
    }

    private marshalCallable(func: Function): Callable {
        let id = uuid()
        this._callables.set(id, func)
        return {_solstice_id: id}
    }
}
