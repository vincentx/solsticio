import {CallableRequest, CallableResponse, Context, Endpoint, Local, Remote} from './communication'
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
                        this._sandbox.receive(sender, request)
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
    private readonly _hostPromise: Promise<Context>
    private readonly _sandbox: Local
    private readonly _sandboxContext: Context
    private readonly _host: Remote

    private _connected: Window | null = null

    constructor(config: Configuration) {
        this._sandbox = new Local()
        this._host = new Remote(this._sandbox)
        this._sandboxContext = this._sandbox.toRemote(config.context)

        this._hostPromise = new Promise<Context>((resolve) => {
            config.container.addEventListener('message', (e) => {
                let request = e.data as SandboxRequest
                let target = config.source(e)
                // @ts-ignore
                let sender = toSender(target)
                try {
                    switch (request.type) {
                        case 'context':
                            this.handleContext(request, target, resolve)
                            break
                        case 'call':
                            this.checkConnectedWith(target)
                            this._sandbox.call(request.callable, ...request.parameters.map((p) => this._host.toLocal(sender, p)))
                            send({id: request.id, type: 'response', response: undefined}, target)
                            break
                        case 'response':
                            this.checkConnectedWith(target)
                            this._host!.receive(sender, request)
                            break
                        case 'error':
                            config.errors.collect(request.error.message)
                            break
                    }
                } catch (message) {
                    send(error(request, message), target)
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
        let sender = toSender(target)
        send(response(request, this._sandboxContext), target)
        resolve(this._host.toLocal(sender, request.context))
    }

    private checkConnectedWith(target: Window) {
        if (!this._connected) throw 'not connected'
        if (this._connected != target) throw 'not allowed'
    }
}

function toSender(window: Window): Endpoint {
    return {
        send(message) {
            window.postMessage(message, '*')
        }
    }
}

function send(message: any, target: Window) {
    target.postMessage(message, '*')
}

function error(request: SandboxRequest, message: any) {
    return {id: request.id, type: 'error', error: {message: message}}
}

function response(request: SandboxRequest, response: any): CallableResponse {
    return {id: request.id, type: 'response', response: response}
}
