import {v4 as uuid} from "uuid";

type SandboxRequest = { id: string, type: "context" }

type SandboxConfiguration = {
    sandbox: Window
    context: any
    source: (e: MessageEvent) => Window
}

export class Proxy<Context> {
    private _target: Window;
    private readonly _queue: Map<string, (value: any) => void> = new Map()

    constructor(receiver: Window, target: Window) {
        this._target = target;

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
            }, "*")
        }), time, fallback)
    }

    private timeout<Context>(promise: Promise<Context>, time: number, fallback: Context) {
        return Promise.race([promise, new Promise<Context>((resolve) => setTimeout(resolve, time, fallback))])
    }
}

export class Sandbox {
    private readonly _self: Window;
    private readonly _context: any;
    private _connected: Window | null = null

    constructor(config: SandboxConfiguration) {
        this._self = config.sandbox;
        this._context = config.context;

        this._self.addEventListener('message', (e) => {
            let request = e.data as SandboxRequest
            if (this._connected != null)
                this.send(errorAlreadyConnected(request), config.source(e))
            else {
                this._connected = config.source(e)
                this.send(this.context(request))
            }
        })
    }

    private context(request: SandboxRequest) {
        return {
            id: request.id,
            response: this._context
        }
    }

    private send(message: any, target: Window | null = null) {
        (target! || this._connected).postMessage(message, '*')
    }
}

function errorAlreadyConnected(request: SandboxRequest) {
    return {
        id: request.id,
        error: {
            message: 'already connected'
        }
    }
}

