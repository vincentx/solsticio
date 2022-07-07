import {v4 as uuid} from 'uuid'

type Context = any

type Callable = { _solstice_id: string }
type CallableRequest = { id: string, type: 'call', callable: string }
type Response = { id: string, type: 'response', response: any }

type SandboxRequest = SandboxConnectRequest | CallableRequest | Response
type SandboxConnectRequest = { id: string, type: 'context', context: Context }
type HostRequest = CallableRequest | Response

type Configuration = {
    window: Window
    context: Context
    source: (e: MessageEvent) => Window
}

class Remote {
    private readonly _receivers: Map<string, (value: any) => void> = new Map()

    receive(response: Response) {
        if (!this._receivers.has(response.id)) throw 'function not called'
        this._receivers.get(response.id)!(response.response)
    }

    send(target: Window, message: (id: string) => any) {
        return new Promise<any>((resolve) => {
            let id = uuid()
            this._receivers.set(id, resolve)
            target.postMessage(message(id), '*')
        })
    }

    fromRemote(context: Context, target: Window) {
        let result: any = {}
        for (let key of Object.keys(context)) {
            if (context[key]._solstice_id) result[key] = this.createCallable(context[key], target)
            else if (typeof context[key] === 'object') result[key] = this.fromRemote(context[key], target)
            else result[key] = context[key]
        }
        return result
    }

    private createCallable(callable: Callable, target: Window) {
        let call = this.send.bind(this)
        return function (): Promise<any> {
            return call(target, (id) => {
                return {id: id, type: 'call', callable: callable._solstice_id}
            })
        }
    }
}

class Local {
    private readonly _callables: Map<string, Function> = new Map()
    private readonly _context: Context;
    private readonly _exported: Context;

    constructor(context: Context) {
        this._context = context;
        this._exported = this.marshal(context)
    }

    toRemote(): Context {
        return this._exported
    }

    receive(request: CallableRequest) {
        if (!this._callables.has(request.callable)) throw 'callback not found'
        return this._callables.get(request.callable)!.apply(this._context)
    }

    private marshal(context: Context): Context {
        let result: Context = {}
        for (let key of Object.keys(context))
            if (typeof context[key] === 'object') result[key] = this.marshal(context[key])
            else if (typeof context[key] === 'function') result[key] = this.marshalCallable(context[key])
            else result[key] = context[key]
        return result
    }

    private marshalCallable(func: Function): Callable {
        let id = uuid()
        this._callables.set(id, func)
        return {_solstice_id: id}
    }
}

export class Host {
    private readonly _sandboxes: Map<string, any> = new Map()
    private readonly _host: Local
    private readonly _sandbox: Remote = new Remote()

    constructor(config: Configuration) {
        this._host = new Local(config.context)

        config.window.addEventListener('message', (e) => {
            let request = e.data as HostRequest
            switch (request.type) {
                case 'response':
                    this._sandbox.receive(request)
                    break
                case 'call':
                    let result = this._host.receive(request)
                    config.source(e).postMessage({id: request.id, type: 'response', response: result}, '*')
                    break
            }

        })
    }

    connect(id: string, sandbox: Window) {
        return this._sandbox.send(sandbox, (id) => {
            return {
                id: id, type: 'context', context: this._host.toRemote()
            }
        }).then(context => this._sandboxes.set(id, this._sandbox.fromRemote(context, sandbox)))
    }

    sandbox(id: string): any {
        return this._sandboxes.get(id)! || {}
    }
}

export class Sandbox {
    private readonly _hostPromise: Promise<Context>
    private readonly _sandbox: Local
    private readonly _host: Remote = new Remote()

    private _connected: Window | null = null

    constructor(config: Configuration) {
        this._sandbox = new Local(config.context)

        this._hostPromise = new Promise<Context>((resolve) => {
            config.window.addEventListener('message', (e) => {
                let request = e.data as SandboxRequest
                let target = config.source(e)
                try {
                    switch (request.type) {
                        case 'context':
                            this.handleContext(request, target, resolve)
                            break
                        case 'call':
                            this.handleCall(request, target)
                            break
                        case 'response':
                            this.handleResponse(request, target)
                            break
                    }
                } catch (message) {
                    this.send(error(request, message), target)
                }
            })
        })
    }

    host(): Promise<Context> {
        return this._hostPromise
    }

    private handleContext(request: SandboxConnectRequest, target: Window, resolve: (value: Context) => void) {
        if (this._connected != null) throw 'already connected'
        this._connected = target
        this.send(response(request, this._sandbox.toRemote()))
        resolve(this._host.fromRemote(request.context, target))
    }

    private handleCall(request: CallableRequest, target: Window) {
        this.checkConnectedWith(target)
        this._sandbox.receive(request)
    }

    private handleResponse(response: Response, target: Window) {
        this.checkConnectedWith(target)
        this._host!.receive(response)
    }

    private checkConnectedWith(target: Window) {
        if (!this._connected) throw 'not connected'
        if (this._connected != target) throw 'not allowed'
    }

    private send(message: any, target: Window | null = null) {
        (target! || this._connected).postMessage(message, '*')
    }
}

function error(request: SandboxRequest, message: any) {
    return {id: request.id, error: {message: message}}
}

function response(request: SandboxRequest, response: any): Response {
    return {id: request.id, type: 'response', response: response}
}
