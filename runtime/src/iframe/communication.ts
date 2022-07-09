import {v4 as uuid} from 'uuid'

export type Context = any
export type Callable = { _solstice_id: string }
export type CallableRequest = { id: string, type: 'call', callable: string, parameters: any[] }
export type CallableResponse = { id: string, type: 'response', response: any }

export interface Endpoint {
    send: (message: Message) => void
}

type UUID = string
type Receiver = (value: any) => void
type Message = { id: string }

export class Remote {
    private readonly _receivers: Map<UUID, Receiver> = new Map()
    private readonly _local: Local

    constructor(local: Local) {
        this._local = local;
    }

    receive(sender: Endpoint, response: CallableResponse) {
        if (!this._receivers.has(response.id)) throw 'callable not called'
        this._receivers.get(response.id)!(this.toLocal_(sender, response.response))
        this._receivers.delete(response.id)
    }

    send(remote: Window, message: (id: string) => any) {
        return this.send_({
            send: (message: { id: string }) => remote.postMessage(message, '*')
        }, message)
    }

    send_(sender: Endpoint, message: (id: string) => Message): Promise<any> {
        return new Promise<any>((resolve) => {
            let id = uuid()
            this._receivers.set(id, resolve)
            sender.send(message(id))
        })
    }

    toLocal(context: Context, remote: Window): Context {
        return this.toLocal_({
            send: (message: { id: string }) => remote.postMessage(message, '*')
        }, context)
    }

    toLocal_(sender: Endpoint, object: any): any {
        if (object == undefined) return undefined
        if (object._solstice_id) return this.toLocalFunction_(sender, object)
        if (Array.isArray(object)) return object.map(v => this.toLocal_(sender, v))
        if (typeof object === 'object') {
            let result: any = {}
            for (let key of Object.keys(object))
                result[key] = this.toLocal_(sender, object[key])
            return result
        }
        return object

    }

    private toLocalFunction_(sender: Endpoint, callable: Callable) {
        let call = this.send_.bind(this)
        let local = this._local
        return function (): Promise<any> {
            let parameters = local.toRemote([...arguments])
            return call(sender, (id) => ({
                id: id,
                type: 'call',
                callable: callable._solstice_id,
                parameters: parameters
            }))
        }
    }
}

export class Local {
    private readonly _callables: Map<UUID, Function> = new Map()
    private readonly _uuid: () => UUID;

    constructor(gen: () => UUID = uuid) {
        this._uuid = gen;
    }

    receive(request: CallableRequest, toLocal: (parameter: any) => any) {
        return this.call(request.callable, ...request.parameters.map(toLocal))
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
