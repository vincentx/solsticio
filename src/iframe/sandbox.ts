import {CallableRequest, CallableResponse, Context, Local, Remote} from './communication'
import {ErrorCollector} from "../error";

type SandboxRequest = SandboxConnectRequest | CallableRequest | CallableResponse
type SandboxConnectRequest = { id: string, type: 'context', context: Context }
type HostRequest = CallableRequest | CallableResponse

export type Configuration = {
    window: Window
    context: Context
    source: (e: MessageEvent) => Window
    errors?: ErrorCollector
}

export class Host {
    private readonly _sandboxes: Map<string, Context> = new Map()
    private readonly _connected: Window[] = []
    private readonly _connecting: Window[] = []
    private readonly _host: Local
    private readonly _sandbox: Remote = new Remote()

    constructor(config: Configuration) {
        this._host = new Local(config.context)

        config.window.addEventListener('message', (e) => {
            let request = e.data as HostRequest
            let target = config.source(e)
            try {
                switch (request.type) {
                    case 'call':
                        this.checkConnectedWith(target)
                        send({id: request.id, type: 'response', response: this._host.receive(request)}, target)
                        break
                    case 'response':
                        this.checkConnectingWith(target)
                        this._sandbox.receive(request)
                        break
                }
            } catch (message) {
                send(error(request, message), target)
            }
        })
    }

    connect(id: string, sandbox: Window): Promise<Context> {
        this._connecting.push(sandbox)
        return this._sandbox.send(sandbox, (id) => ({id: id, type: 'context', context: this._host.toRemote()}))
            .then(context => {
                this._sandboxes.set(id, this._sandbox.fromRemote(context, sandbox))
                this._connected.push(sandbox)
                return context
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
                            this.checkConnectedWith(target)
                            this._sandbox.receive(request)
                            send({id: request.id, type: 'response', response: undefined}, target)
                            break
                        case 'response':
                            this.checkConnectedWith(target)
                            this._host!.receive(request)
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
        send(response(request, this._sandbox.toRemote()), target)
        resolve(this._host.fromRemote(request.context, target))
    }
    private checkConnectedWith(target: Window) {
        if (!this._connected) throw 'not connected'
        if (this._connected != target) throw 'not allowed'
    }
}

function send(message: any, target: Window) {
    target.postMessage(message, '*')
}

function error(request: SandboxRequest, message: any) {
    return {id: request.id, error: {message: message}}
}

function response(request: SandboxRequest, response: any): CallableResponse {
    return {id: request.id, type: 'response', response: response}
}
