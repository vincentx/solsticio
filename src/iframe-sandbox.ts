import {v4 as uuid} from 'uuid'

type SandboxConnectRequest = { id: string, type: 'context' }
type SandboxCallRequest = { id: string, type: 'call', callback: string }

type SandboxRequest = SandboxConnectRequest | SandboxCallRequest

type SandboxConfiguration = {
    sandbox: Window
    context: any
    source: (e: MessageEvent) => Window
}

export class Proxy<Context> {
    private _target: Window
    private readonly _queue: Map<string, (value: any) => void> = new Map()

    constructor(receiver: Window, target: Window) {
        this._target = target

        receiver.addEventListener('message', (e) => {
            let message = e.data as { id: string, response: any }
            if (this._queue.has(message.id)) {
                let resolve = this._queue.get(message.id)!
                this._queue.delete(message.id)
                resolve(message.response)
            }
        })
    }

    fetch(time: number, fallback: Context): Promise<Context> {
        return this.timeout(new Promise<Context>((resolve) => {
            let id = uuid()
            this._queue.set(id, resolve)
            this._target.postMessage({
                id: id,
                request: 'context'
            }, '*')
        }), time, fallback)
    }

    private timeout<Context>(promise: Promise<Context>, time: number, fallback: Context) {
        return Promise.race([promise, new Promise<Context>((resolve) => setTimeout(resolve, time, fallback))])
    }
}

export class Sandbox {
    private readonly _self: Window
    private readonly _context: any
    private _connected: Window | null = null
    private _callbacks: Map<string, Function> = new Map()

    constructor(config: SandboxConfiguration) {
        this._self = config.sandbox
        this._context = this.marshal(config.context)

        this._self.addEventListener('message', (e) => {
            let request = e.data as SandboxRequest
            switch (request.type) {
                case 'context':
                    this.handleContext(request, config.source(e))
                    break
                case 'call':
                    this.handleCall(request, config.source(e))
                    break
            }
        })
    }

    private handleContext(request: SandboxConnectRequest, target: Window) {
        if (this._connected != null)
            this.send(errorAlreadyConnected(request), target)
        else {
            this._connected = target
            this.send(this.context(request))
        }
    }

    private handleCall(request: SandboxCallRequest, target: Window) {
        if (!this._connected) this.send(errorNotConnected(request), target)
        else if (this._connected != target) this.send(errorNotAllowed(request), target)
        else if (!this._callbacks.has(request.callback)) this.send(errorCallbackNotFound(request))
        else this._callbacks.get(request.callback)!.apply(this._context)
    }

    private context(request: SandboxRequest) {
        return {
            id: request.id,
            response: this._context
        }
    }

    private marshal(context: any) {
        let result: any = {}
        for (let key of Object.keys(context)) {
            if (typeof context[key] === 'object') result[key] = this.marshal(context[key])
            else if (context[key] instanceof Function) result[key] = this.marshalFunction(context[key])
            else result[key] = context[key]
        }
        return result
    }

    private marshalFunction(func: Function) {
        let id = uuid()
        this._callbacks.set(id, func)
        return {id: id}
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

function error(request: SandboxRequest, message: string) {
    return {id: request.id, error: {message: message}}
}
