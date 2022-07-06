import {v4 as uuid} from 'uuid'

type Context = any

type SandboxRequest = SandboxConnectRequest | SandboxCallRequest | SandboxFunctionResultRequest
type SandboxConnectRequest = { id: string, type: 'context', context: Context }
type SandboxCallRequest = { id: string, type: 'call', callback: string }
type SandboxFunctionResultRequest = { id: string, type: 'result', result: any }

type SandboxResponse = { id: string, response: any }
type SandboxCallback = { _solstice_callback_id: string }

type SandboxConfiguration = {
    sandbox: Window
    context: Context
    source: (e: MessageEvent) => Window
}

export class Host {
    private _resolvers: Map<string, (value: any) => void> = new Map()
    private _sandboxes: Map<string, any> = new Map()

    constructor(host: Window) {
        host.addEventListener('message', (e) => {
            let response = e.data as SandboxResponse
            this._resolvers.get(response.id)!(response.response)
        })
    }

    connect(id: string, sandbox: Window) {
        return new Promise<Context>((resolve) => {
            let id = uuid()
            this._resolvers.set(id, resolve)
            sandbox.postMessage({
                id: id,
                type: 'context'
            }, '*')
        }).then(context => this._sandboxes.set(id, this.unmarshal(context, sandbox)))
    }

    sandbox(id: string): any {
        return this._sandboxes.get(id)! || {}
    }

    private unmarshal(context: Context, sandbox: Window) {
        let result: any = {}
        for (let key of Object.keys(context)) {
            if (context[key]._solstice_callback_id) result[key] = this.unmarshalCallback(context[key]._solstice_callback_id, sandbox)
            else if (typeof context[key] === 'object') result[key] = this.unmarshal(context[key], sandbox)
            else result[key] = context[key]
        }
        return result
    }

    private unmarshalCallback(id: string, sandbox: Window) {
        return function () {
            sandbox.postMessage({
                id: uuid(),
                type: 'call',
                callback: id
            }, '*')
        }
    }
}

export class Sandbox {
    private readonly _self: Window
    private readonly _context: Context
    private _connected: Window | null = null
    private _callbacks: Map<string, Function> = new Map()
    private _resolvers: Map<string, (value: any) => void> = new Map()
    private readonly _host: Promise<Context>

    constructor(config: SandboxConfiguration) {
        this._self = config.sandbox
        this._context = this.marshal(config.context)

        this._host = new Promise<Context>((resolve) => {
            this._self.addEventListener('message', (e) => {
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
            this.send(this.context(request))
            resolve(this.unmarshal(request.context, this._connected))
        }
    }

    private handleCall(request: SandboxCallRequest, target: Window) {
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

    private context(request: SandboxRequest) {
        return {
            id: request.id,
            response: this._context
        }
    }

    private marshal(context: Context) {
        let result: Context = {}
        for (let key of Object.keys(context)) {
            if (typeof context[key] === 'object') result[key] = this.marshal(context[key])
            else if (context[key] instanceof Function) result[key] = this.marshalCallback(context[key])
            else result[key] = context[key]
        }
        return result
    }

    private marshalCallback(func: Function): SandboxCallback {
        let id = uuid()
        this._callbacks.set(id, func)
        return {_solstice_callback_id: id}
    }

    private unmarshal(context: any, host: Window) {
        let result: any = {}
        for (let key of Object.keys(context || {})) {
            if (context[key]._solstice_function_id) result[key] = this.unmarshalCallback(context[key]._solstice_function_id, host)
            else if (typeof context[key] === 'object') result[key] = this.unmarshal(context[key], host)
            else result[key] = context[key]
        }
        return result
    }

    private unmarshalCallback(id: string, host: Window) {
        let resolvers = this._resolvers
        return function (): Promise<any> {
            return new Promise<any>((resolve) => {
                let messageId = uuid()
                resolvers.set(messageId, resolve)
                host.postMessage({id: messageId, type: 'call', function: id}, '*')
            })
        }
    }

    private send(message: any, target: Window | null = null) {
        (target! || this._connected).postMessage(message, '*')
    }
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
