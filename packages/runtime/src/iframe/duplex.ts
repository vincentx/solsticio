import {v4} from 'uuid'

export type Context = any
export type Callable = { _solstice_id: string }
export type CallableRequest = { id: string, type: 'call', callable: string, parameters: any[] }
export type CallableResponse = { id: string, type: 'response', response: any }

export interface Endpoint {
    call: (id: UUID, callable: UUID, parameters: any[]) => void
    returns: (id: UUID, result: any) => void
}

type UUID = string
type Receiver = (value: any) => void

export class DuplexCallable {
    private readonly _local: Local
    private readonly _remote: Remote

    constructor(local: Local, remote: Remote) {
        this._local = local
        this._remote = remote
    }

    handle(sender: Endpoint, request: CallableRequest | CallableResponse) {
        switch (request.type) {
            case 'call':
                let result = this._local.call(request.callable, ...request.parameters.map(_ => this._remote.toLocal(sender, _)))
                sender.returns!(request.id, result)
                break
            case 'response':
                this._remote.receive(sender, request.id, request.response)
                break
        }
    }
}

export class Remote {
    private readonly _receivers: Map<UUID, Receiver> = new Map()
    private readonly _local: Local
    private readonly _uuid: () => UUID;

    constructor(local: Local, uuid: () => UUID = v4) {
        this._local = local;
        this._uuid = uuid;
    }

    receive(sender: Endpoint, id: UUID, result: any) {
        if (!this._receivers.has(id)) throw 'callable not called'
        this._receivers.get(id)!(this.toLocal(sender, result))
        this._receivers.delete(id)
    }

    call(remote: Endpoint, callable: UUID, parameters: any[]): Promise<any> {
        return new Promise<any>((resolve) => {
            let id = this._uuid()
            this._receivers.set(id, resolve)
            remote.call!(id, callable, this._local.toRemote(parameters))
        })
    }

    toLocal(sender: Endpoint, object: any): any {
        if (object && object._solstice_id) return this.toLocalFunction(sender, object)
        if (Array.isArray(object)) return object.map(v => this.toLocal(sender, v))
        if (typeof object === 'object') {
            let result: any = {}
            for (let key of Object.keys(object))
                result[key] = this.toLocal(sender, object[key])
            return result
        }
        return object
    }

    private toLocalFunction(sender: Endpoint, callable: Callable) {
        let call = this.call.bind(this)
        return function (): Promise<any> {
            return call(sender, callable._solstice_id, [...arguments])
        }
    }
}

export class Local {
    private readonly _callables: Map<UUID, Function> = new Map()
    private readonly _uuid: () => UUID;

    constructor(uuid: () => UUID = v4) {
        this._uuid = uuid;
    }

    named(functions: Map<UUID, Function>) {
        for (let key of functions.keys())
            if (!this._callables.has(key)) this._callables.set(key, functions.get(key)!)
    }

    call(id: UUID, ...parameters: any[]) {
        if (!this._callables.has(id)) throw 'unknown callable'
        return this.toRemote(this._callables.get(id)!(...parameters))
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
