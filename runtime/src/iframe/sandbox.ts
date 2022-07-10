import {CallableRequest, CallableResponse, Context, DuplexCallable, Local, Remote} from './duplex'
import {ErrorCollector} from '../core/error'

type Error = { id: string, type: 'error', error: { message: string } }
type SolsticeRequest = CallableRequest | CallableResponse | Error

export type Configuration = {
    container: Window
    context: Context
    errors: ErrorCollector
    event?: (e: MessageEvent) => MessageEvent
}

const Connect = '_solstice_connect_sandbox'

export class Host {
    private readonly _sandboxes: Map<string, Context> = new Map()
    private readonly _context: Context
    private readonly _sandbox: Remote

    private readonly _config: Configuration;
    private readonly _origins: string[] = []

    constructor(config: Configuration) {
        let host = new Local()
        this._sandbox = new Remote(host)
        this._context = host.toRemote(config.context)
        this._config = config

        config.container.addEventListener('message', handle(config, new DuplexCallable(host, this._sandbox), this._origins))
    }

    connect(id: string, sandbox: Window, origin: string): Promise<Context> {
        let remote = endpoint(sandbox, origin)
        this._origins.push(origin)
        return this._sandbox.call(remote, Connect, [this._context])
            .then((context) => {
                if (this._sandboxes.has(id)) {
                    this._config.errors.error(id, 'already registered')
                } else {
                    let sandbox = this._sandbox.toLocal(remote, context)
                    this._sandboxes.set(id, sandbox)
                    return sandbox
                }
            })
    }

    sandbox(id: string): any {
        return this._sandboxes.get(id)! || {}
    }
}

export class Sandbox {
    private readonly _host: Promise<Context>

    constructor(config: Configuration, hostOrigin: string) {
        let sandbox = new Local()

        this._host = new Promise<Context>((resolve) => {
            let context = sandbox.toRemote(config.context)
            sandbox.named(new Map([[Connect, function (host: Context) {
                resolve(host)
                return context
            }]]))
        })

        config.container.addEventListener('message', handle(config,
            new DuplexCallable(sandbox, new Remote(sandbox)), [hostOrigin]))
    }

    host(): Promise<Context> {
        return this._host
    }
}

function handle(config: Configuration, duplex: DuplexCallable, origins: string[]) {
    return function (event: MessageEvent) {
        let e = config.event ? config.event(event) : event

        if (!isSolsticeRequest(e.data) || !origins.includes(e.origin)) return
        let request = e.data as SolsticeRequest
        let remote = endpoint(e.source as Window, e.origin)

        try {
            if (isError(request)) config.errors.collect(request.error.message)
            else duplex.handle(remote, request as CallableRequest | CallableResponse)
        } catch (message) {
            remote.error(request, message)
        }
    }
}

function endpoint(window: Window, origin: string) {
    return {
        error(request: SolsticeRequest, message: any) {
            window.postMessage({id: request.id, type: 'error', error: {message: message}}, origin)
        },

        call(id: string, callable: string, parameters: any[]) {
            window.postMessage({id: id, type: 'call', callable: callable, parameters: parameters}, origin)
        },

        returns(id: string, result: any) {
            window.postMessage({id: id, type: 'response', response: result}, origin)
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
