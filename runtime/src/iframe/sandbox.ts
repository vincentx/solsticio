import {CallableRequest, CallableResponse, Context, DuplexCallable, Endpoint, Local, Remote} from './duplex'
import {ErrorCollector} from '../core/error'

type Error = { id: string, type: 'error', error: { message: string } }
type SandboxRequest = SandboxConnectRequest | CallableRequest | CallableResponse | Error
type SandboxConnectRequest = { id: string, type: 'context', context: Context }
type HostRequest = CallableRequest | CallableResponse | Error

export type Configuration = {
    container: Window
    context: Context
    source: (e: MessageEvent) => Window
    errors: ErrorCollector
}

const Connect = '_solstice_connect_sandbox'

export class Host {
    private readonly _sandboxes: Map<string, Context> = new Map()
    private readonly _connected: Window[] = []
    private readonly _connecting: Window[] = []
    private readonly _host: Local
    private readonly _hostContext: Context
    private readonly _sandbox: Remote
    private readonly _config: Configuration;

    constructor(config: Configuration) {
        this._config = config
        this._host = new Local()
        this._sandbox = new Remote(this._host)
        this._hostContext = this._host.toRemote(config.context)

        config.container.addEventListener('message', (e) => {
            let request = e.data as HostRequest
            let target = config.source(e)
            let sender = toSender(target)
            try {
                switch (request.type) {
                    case 'call':
                        this.checkConnectedWith(target)
                        let result = this._host.toRemote(this._host.call(request.callable, ...request.parameters.map((p) => this._sandbox.toLocal(sender, p))))
                        send({
                            id: request.id,
                            type: 'response',
                            response: result
                        }, target)
                        break
                    case 'response':
                        this.checkConnectingWith(target)
                        this._sandbox.receive(sender, request.id, request.response)
                        break
                    case 'error':
                        config.errors.collect(request.error.message)
                        break
                }
            } catch (message) {
                send(error(request, message), target)
            }
        })
    }

    connect(id: string, sandbox: Window): Promise<Context> {
        let sender = toSender(sandbox)
        this._connecting.push(sandbox)
        return this._sandbox.send(sender, (id) => ({id: id, type: 'context', context: this._hostContext}))
            .then(context => {
                if (this._sandboxes.has(id)) {
                    this._connecting.splice(this._connecting.indexOf(sandbox), 1)
                    this._config.errors.error(id, 'already registered')
                } else {
                    let remote = this._sandbox.toLocal(sender, context)
                    this._sandboxes.set(id, remote)
                    this._connected.push(sandbox)
                    return remote
                }
            })
    }

    sandbox(id: string): any {
        return this._sandboxes.get(id)! || {}
    }

    private checkConnectedWith(target: Window) {
        if (!this._connected.includes(target)) throw 'not allowed'
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
            if (!this.isSandboxRequest(e.data)) return

            let request = e.data as SandboxRequest
            let target = config.source(e)
            let sender = toSender(target)

            try {
                if (this.isError(request)) {
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

    private isSandboxRequest(request: any): request is SandboxRequest {
        return request && request.id && ((request.type === 'call' && request.callable && request.parameters) ||
            (request.type === 'response' && request.response) ||
            (request.type === 'error' && request.error && request.error.message))
    }

    private isError(request: SandboxRequest): request is Error {
        return request.type === 'error'
    }

    private isConnect(request: SandboxRequest): request is CallableRequest {
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
        send(message) {
            window.postMessage(message, '*')
        },

        call(id: string, callable: string, parameters: any[]) {
            window.postMessage({id: id, type: 'call', callable: callable, parameters: parameters}, '*')
        },

        returns(id: string, result: any) {
            window.postMessage({id: id, type: 'response', response: result}, '*')
        }
    }
}

function send(message: any, target: Window) {
    target.postMessage(message, '*')
}

function error(request: SandboxRequest, message: any) {
    return {id: request.id, type: 'error', error: {message: message}}
}
