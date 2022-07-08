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
                    case 'response':
                        this.checkConnectingWith(target)
                        this._sandbox.receive(request)
                        break
                    case 'call':
                        this.checkConnectedWith(target)
                        let result = this._host.receive(request)
                        send({id: request.id, type: 'response', response: result}, target)
                        break
                }
            } catch (message) {
                send(error(request, message), target)
            }
        })
    }

    connect(id: string, sandbox: Window) {
        this._connecting.push(sandbox)
        return this._sandbox.send(sandbox, (id) => ({id: id, type: 'context', context: this._host.toRemote()}))
            .then(context => {
                this._sandboxes.set(id, this._sandbox.fromRemote(context, sandbox))
                this._connected.push(sandbox)
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
                            this.handleCall(request, target)
                            break
                        case 'response':
                            this.handleResponse(request, target)
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

    private handleCall(request: CallableRequest, target: Window) {
        this.checkConnectedWith(target)
        this._sandbox.receive(request)
        send({id: request.id, type: 'response', response: undefined}, target)
    }

    private handleResponse(response: CallableResponse, target: Window) {
        this.checkConnectedWith(target)
        this._host!.receive(response)
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
