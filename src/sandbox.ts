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

class CallableReturns {
    private _returns: Map<string, (value: any) => void> = new Map()

    waitFor(send: (id: string) => void) {
        return new Promise<Context>((resolve) => {
            let id = uuid()
            this._returns.set(id, resolve)
            send(id)
        })
    }

    handle(response: Response, send: (message: any) => void) {
        if (!this._returns.has(response.id)) send(errorHostFunctionNotCalled(response))
        else this._returns.get(response.id)!(response.response)
    }
}

class Callables {
    private _callables: Map<string, Function> = new Map()

    marshal(context: Context): Context {
        let result: Context = {}
        for (let key of Object.keys(context)) {
            if (typeof context[key] === 'object') result[key] = this.marshal(context[key])
            else if (typeof context[key] === 'function') result[key] = this.marshalCallable(context[key])
            else result[key] = context[key]
        }
        return result
    }

    private marshalCallable(func: Function): Callable {
        let id = uuid()
        this._callables.set(id, func)
        return {_solstice_id: id}
    }

    call(request: CallableRequest, context: any, send: (message: any) => void) {
        if (!this._callables.has(request.callable)) send(errorCallbackNotFound(request))
        else this._callables.get(request.callable)!.apply(context)
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
    private readonly _context: Context
    private _connected: Window | null = null
    private readonly _host: Promise<Context>

    private _returns: CallableReturns = new CallableReturns()
    private _callables: Callables = new Callables()

    constructor(config: Configuration) {
        this._context = this._callables.marshal(config.context)

        this._host = new Promise<Context>((resolve) => {
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
        return this._host
    }

    private handleContext(request: SandboxConnectRequest, target: Window, resolve: (value: Context) => void) {
        if (this._connected != null)
            this.send(errorAlreadyConnected(request), target)
        else {
            this._connected = target
            this.send(response(request, this._context))
            resolve(unmarshal(request.context, this.unmarshalFunction.bind(this)))
        }
    }

    private handleCall(request: CallableRequest, target: Window) {
        if (!this._connected) this.send(errorNotConnected(request), target)
        else if (this._connected != target) this.send(errorNotAllowed(request), target)
        else this._callables.call(request, this._context, this.send.bind(this))
    }

    private handleResponse(request: Response, target: Window) {
        if (!this._connected) this.send(errorNotConnected(request), target)
        else if (this._connected != target) this.send(errorNotAllowed(request), target)
        else this._returns.handle(request, this.send.bind(this))
    }

    private unmarshalFunction(callable: Callable) {
        let send = this.send.bind(this)
        let replier = this._returns
        return function (): Promise<any> {
            return replier.waitFor(id => send({id: id, type: 'call', callable: callable._solstice_id}))
        }
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

function errorCallbackNotFound(request: SandboxRequest) {
    return error(request, 'callback not found')
}

function errorNotConnected(request: SandboxRequest) {
    return error(request, 'not connected')
}

function errorNotAllowed(request: SandboxRequest) {
    return error(request, 'not allowed')
}

function errorHostFunctionNotCalled(request: SandboxRequest) {
    return error(request, 'host function not called')
}

function error(request: SandboxRequest, message: string) {
    return {id: request.id, error: {message: message}}
}

function response(request: SandboxRequest, response: any): SandboxResponse {
    return {id: request.id, type: 'response', response: response}
}
