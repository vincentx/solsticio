import {CallableRequest, CallableResponse, Local, Remote, Context} from './communication'

type SandboxRequest = SandboxConnectRequest | CallableRequest | CallableResponse
type SandboxConnectRequest = { id: string, type: 'context', context: Context }
type HostRequest = CallableRequest | CallableResponse

type Configuration = {
    window: Window
    context: Context
    source: (e: MessageEvent) => Window
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
    private readonly _host: Remote

    private _connected: Window | null = null

    constructor(config: Configuration) {
        this._sandbox = new Local(config.context)
        this._host = new Remote()

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

    private handleResponse(response: CallableResponse, target: Window) {
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

function response(request: SandboxRequest, response: any): CallableResponse {
    return {id: request.id, type: 'response', response: response}
}
