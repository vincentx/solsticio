import {CallableRequest, CallableResponse, Context, DuplexCallable, Endpoint, Local, Remote} from './duplex'
import {ErrorCollector} from '../core/error'

type Error = { id: string, type: 'error', error: { message: string } }
type SolsticeRequest = CallableRequest | CallableResponse | Error

export type Configuration = {
    container: Window
    context: Context
    source: (e: MessageEvent) => Window
    errors: ErrorCollector
}

const Connect = '_solstice_connect_sandbox'

export class Host {
    private readonly _sandboxes: Map<string, Context> = new Map()
    private readonly _context: Context
    private readonly _sandbox: Remote

    private readonly _config: Configuration;
    private readonly _connecting: Window[] = []

    constructor(config: Configuration) {
        let host = new Local()
        this._sandbox = new Remote(host)
        this._context = host.toRemote(config.context)
        this._config = config

        let duplex = new DuplexCallable(host, this._sandbox)

        config.container.addEventListener('message', (e) => {
            if (!isSolsticeRequest(e.data)) return
            let request = e.data as SolsticeRequest
            let target = config.source(e)
            let sender = toSender(target)

            try {
                if (isError(request)) config.errors.collect(request.error.message)
                else {
                    this.checkConnectingWith(target)
                    duplex.handle(sender, request as CallableRequest)
                }
            } catch (message) {
                send(error(request, message), target)
            }
        })
    }

    connect(id: string, sandbox: Window): Promise<Context> {
        let sender = toSender(sandbox)
        this._connecting.push(sandbox)
        return this._sandbox.call(sender, Connect, [this._context])
            .then((context) => {
                if (this._sandboxes.has(id)) {
                    this._config.errors.error(id, 'already registered')
                } else {
                    let sandbox = this._sandbox.toLocal(sender, context)
                    this._sandboxes.set(id, sandbox)
                    return sandbox
                }
            })
    }

    sandbox(id: string): any {
        return this._sandboxes.get(id)! || {}
    }

    private checkConnectingWith(target: Window) {
        if (!this._connecting.includes(target)) throw 'not allowed'
    }
}

export class Sandbox {
    private _connected: Window | null = null
    private readonly _host: Promise<Context>

    constructor(config: Configuration) {
        let sandbox = new Local()
        let host = new Remote(sandbox)

        this._host = new Promise<Context>((resolve) => {
            let context = sandbox.toRemote(config.context)
            sandbox.named(new Map([[Connect, function (host: Context) {
                resolve(host)
                return context
            }]]))
        })

        let duplex = new DuplexCallable(sandbox, host)

        config.container.addEventListener('message', (e: MessageEvent) => {
            if (!isSolsticeRequest(e.data)) return

            let request = e.data as SolsticeRequest
            let target = config.source(e)
            let sender = toSender(target)

            try {
                if (isError(request)) {
                    config.errors.collect(request.error.message)
                } else if (this.isConnect(request)) {
                    this.checkNotConnected()
                    this._connected = target
                    duplex.handle(sender, request as CallableRequest)
                } else {
                    this.checkConnected(target)
                    duplex.handle(sender, request as CallableRequest | CallableResponse)
                }
            } catch (message) {
                send(error(request, message), target)
            }
        })
    }

    private isConnect(request: SolsticeRequest): request is CallableRequest {
        return request.type === 'call' && request.callable === Connect
    }

    private checkNotConnected() {
        if (this._connected != null) throw 'already connected'
    }

    private checkConnected(target: Window) {
        if (this._connected == null) throw 'not connected'
        if (this._connected != target) throw 'not allowed'
    }

    host(): Promise<Context> {
        return this._host
    }
}

function toSender(window: Window): Endpoint {
    return {
        call(id: string, callable: string, parameters: any[]) {
            window.postMessage({id: id, type: 'call', callable: callable, parameters: parameters}, '*')
        },

        returns(id: string, result: any) {
            window.postMessage({id: id, type: 'response', response: result}, '*')
        }
    }
}

function isError(request: SolsticeRequest): request is Error {
    return request.type === 'error'
}

function isSolsticeRequest(request: any): request is SolsticeRequest {
    return request && request.id && ((request.type === 'call' && request.callable && request.parameters) ||
        (request.type === 'response' && request.response) ||
        (request.type === 'error' && request.error && request.error.message))
}

function send(message: any, target: Window) {
    target.postMessage(message, '*')
}

function error(request: SolsticeRequest, message: any) {
    return {id: request.id, type: 'error', error: {message: message}}
}
