import {v4 as uuid} from 'uuid'

type Context = any

type Callable = { _solstice_id: string }

type SandboxRequest = SandboxConnectRequest | SandboxCallbackRequest | SandboxFunctionResultRequest
type SandboxConnectRequest = { id: string, type: 'context', context: Context }
type SandboxCallbackRequest = { id: string, type: 'call', callback: string }
type SandboxFunctionResultRequest = { id: string, type: 'result', result: any }

type HostRequest = SandboxResponse | SandboxFunctionRequest
type SandboxResponse = { id: string, type: 'response', response: any }
type SandboxFunctionRequest = { id: string, type: 'call', function: string }

type Configuration = {
    window: Window
    context: Context
    source: (e: MessageEvent) => Window
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
                    let result = this._functions.get(request.function)!.apply(this._context)
                    config.source(e).postMessage({
                        id: request.id,
                        type: 'result',
                        result: result
                    }, '*')
                    break
            }

        })
    }

    connect(id: string, sandbox: Window) {
        return new Promise<Context>((resolve) => {
            let id = uuid()
            this._resolvers.set(id, resolve)
            sandbox.postMessage({
                id: id, type: 'context', context: this._context
            }, '*')
        }).then(context => this._sandboxes.set(id, unmarshal(context, this.unmarshalCallback(sandbox).bind(this))))
    }

    sandbox(id: string): any {
        return this._sandboxes.get(id)! || {}
    }

    private marshalFunction(api: Function): Callable {
        let id = uuid()
        this._functions.set(id, api)
        return {_solstice_id: id}
    }

    private unmarshalCallback(sandbox: Window) {
        return function (callback: Callable) {
            return function () {
                sandbox.postMessage({id: uuid(), type: 'call', callback: callback._solstice_id}, '*')
            }
        }
    }
}

export class Sandbox {
    private readonly _context: Context
    private _connected: Window | null = null
    private _callbacks: Map<string, Function> = new Map()
    private _resolvers: Map<string, (value: any) => void> = new Map()
    private readonly _host: Promise<Context>

    constructor(config: Configuration) {
        this._context = marshal(config.context, this.marshalCallback.bind(this))

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
                    case 'result':
                        this.handleReturn(request, config.source(e))
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

    private handleCall(request: SandboxCallbackRequest, target: Window) {
        if (!this._connected) this.send(errorNotConnected(request), target)
        else if (this._connected != target) this.send(errorNotAllowed(request), target)
        else if (!this._callbacks.has(request.callback)) this.send(errorCallbackNotFound(request))
        else this._callbacks.get(request.callback)!.apply(this._context)
    }

    private handleReturn(request: SandboxFunctionResultRequest, target: Window) {
        if (!this._connected) this.send(errorNotConnected(request), target)
        else if (this._connected != target) this.send(errorNotAllowed(request), target)
        else if (!this._resolvers.has(request.id)) this.send(errorHostFunctionNotCalled(request))
        else this._resolvers.get(request.id)!(request.result)
    }

    private marshalCallback(func: Function): Callable {
        let id = uuid()
        this._callbacks.set(id, func)
        return {_solstice_id: id}
    }

    private unmarshalFunction(callable: Callable) {
        let resolvers = this._resolvers
        let send = this.send.bind(this)
        return function (): Promise<any> {
            return new Promise<any>((resolve) => {
                let messageId = uuid()
                resolvers.set(messageId, resolve)
                send({id: messageId, type: 'call', function: callable._solstice_id})
            })
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
