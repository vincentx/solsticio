import {v4 as uuid} from 'uuid'

type Context = any

type Callable = { _solstice_id: string }
type CallableRequest = { id: string, type: 'call', callable: string }
type Response = { id: string, type: 'response', response: any }

type SandboxRequest = SandboxConnectRequest | CallableRequest | Response
type SandboxConnectRequest = { id: string, type: 'context', context: Context }

type HostRequest = CallableRequest | Response
type SandboxResponse = { id: string, type: 'response', response: any }

type Configuration = {
    window: Window
    context: Context
    source: (e: MessageEvent) => Window
}

class Consumer {
    private readonly _returns: Map<string, (value: any) => void> = new Map()
    private readonly _context: Context
    private readonly _target: Window

    constructor(target: Window, marshaled: Context) {
        this._target = target
        this._context = this.unmarshal(marshaled)
    }

    context(): Context {
        return this._context
    }

    private unmarshal(context: Context) {
        let result: any = {}
        for (let key of Object.keys(context)) {
            if (context[key]._solstice_id) result[key] = this.unmarshalCallable(context[key])
            else if (typeof context[key] === 'object') result[key] = this.unmarshal(context[key])
            else result[key] = context[key]
        }
        return result
    }

    private unmarshalCallable(callable: Callable) {
        let target = this._target
        let returns = this._returns
        return function (): Promise<any> {
            return new Promise<Context>((resolve) => {
                let id = uuid()
                returns.set(id, resolve)
                target.postMessage({id: id, type: 'call', callable: callable._solstice_id}, '*')
            })
        }
    }

    handle(response: Response) {
        if (!this._returns.has(response.id)) throw 'host function not called'
        this._returns.get(response.id)!(response.response)
    }
}

class Provider {
    private readonly _callables: Map<string, Function> = new Map()
    private readonly _context: Context;
    private readonly _marshaled: Context;

    constructor(context: Context) {
        this._context = context;
        this._marshaled = this.marshal(context)
    }

    marshaled(): Context {
        return this._marshaled
    }

    call(request: CallableRequest) {
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
    private _resolvers: Map<string, (value: any) => void> = new Map()
    private _sandboxes: Map<string, any> = new Map()
    private _functions: Map<string, Function> = new Map()
    private readonly _context: Context;

    constructor(config: Configuration) {
        this._context = marshal(config.context, this.marshalFunction.bind(this))
        config.window.addEventListener('message', (e) => {
            let request = e.data as HostRequest
            switch (request.type) {
                case 'response':
                    this._resolvers.get(request.id)!(request.response)
                    break
                case 'call':
                    let result = this._functions.get(request.callable)!.apply(this._context)
                    config.source(e).postMessage({id: request.id, type: 'response', response: result}, '*')
                    break
            }

        })
    }

    connect(id: string, sandbox: Window) {
        return this.waitForReply(id => sandbox.postMessage({
                id: id, type: 'context', context: this._context
            }, '*')
        ).then(context => this._sandboxes.set(id, unmarshal(context, this.unmarshalCallback(sandbox).bind(this))))
    }

    sandbox(id: string): any {
        return this._sandboxes.get(id)! || {}
    }

    private waitForReply(sendMessage: (id: string) => void) {
        return new Promise<Context>((resolve) => {
            let id = uuid()
            this._resolvers.set(id, resolve)
            sendMessage(id)
        })
    }

    private marshalFunction(api: Function): Callable {
        let id = uuid()
        this._functions.set(id, api)
        return {_solstice_id: id}
    }

    private unmarshalCallback(sandbox: Window) {
        return function (callable: Callable) {
            return function () {
                sandbox.postMessage({id: uuid(), type: 'call', callable: callable._solstice_id}, '*')
            }
        }
    }
}

export class Sandbox {
    private readonly _hostPromise: Promise<Context>
    private readonly _context: Provider

    private _connected: Window | null = null
    private _host: Consumer | null = null

    constructor(config: Configuration) {
        this._context = new Provider(config.context)

        this._hostPromise = new Promise<Context>((resolve) => {
            config.window.addEventListener('message', (e) => {
                let request = e.data as SandboxRequest
                switch (request.type) {
                    case 'context':
                        this.handleContext(request, config.source(e), resolve)
                        break
                    case 'call':
                        this.handleCall(request, config.source(e))
                        break
                    case 'response':
                        this.handleResponse(request, config.source(e))
                        break
                }
            })
        })
    }

    host(): Promise<Context> {
        return this._hostPromise
    }

    private handleContext(request: SandboxConnectRequest, target: Window, resolve: (value: Context) => void) {
        if (this._connected != null)
            this.send(errorAlreadyConnected(request), target)
        else {
            this._connected = target
            this.send(response(request, this._context.marshaled()))
            this._host = new Consumer(this._connected, request.context)
            resolve(this._host.context())
        }
    }

    private handleCall(request: CallableRequest, target: Window) {
        try {
            this.checkConnectedWith(target)
            this._context.call(request)
        } catch (message) {
            this.send(error(request, message), target)
        }
    }

    private handleResponse(request: Response, target: Window) {
        try {
            this.checkConnectedWith(target)
            this._host!.handle(request)
        } catch (message) {
            this.send(error(request, message), target)
        }
    }

    private checkConnectedWith(target: Window) {
        if (!this._connected) throw 'not connected'
        if (this._connected != target) throw 'not allowed'
    }

    private send(message: any, target: Window | null = null) {
        (target! || this._connected).postMessage(message, '*')
    }
}

function marshal(context: Context, marshalFunction: (f: Function) => Callable): Context {
    let result: Context = {}
    for (let key of Object.keys(context)) {
        if (typeof context[key] === 'object') result[key] = marshal(context[key], marshalFunction)
        else if (typeof context[key] === 'function') result[key] = marshalFunction(context[key])
        else result[key] = context[key]
    }
    return result
}

function unmarshal(context: Context, unmarshalCallable: (c: Callable) => Function) {
    let result: any = {}
    for (let key of Object.keys(context)) {
        if (context[key]._solstice_id) result[key] = unmarshalCallable(context[key])
        else if (typeof context[key] === 'object') result[key] = unmarshal(context[key], unmarshalCallable)
        else result[key] = context[key]
    }
    return result
}

function errorAlreadyConnected(request: SandboxRequest) {
    return error(request, 'already connected')
}

function error(request: SandboxRequest, message: any) {
    return {id: request.id, error: {message: message}}
}

function response(request: SandboxRequest, response: any): SandboxResponse {
    return {id: request.id, type: 'response', response: response}
}
