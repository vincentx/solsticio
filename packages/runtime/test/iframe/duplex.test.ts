import {beforeEach, describe, expect, it, vi} from "vitest";
import {DuplexCallable, Local, Remote} from "../../src/iframe/duplex";
import * as Communication from "../../src/iframe/duplex";

describe('Duplex Callable', () => {
    let _sender, _local, _remote
    let _duplex: DuplexCallable

    beforeEach(() => {
        _sender = {
            send: vi.fn(),
            call: vi.fn(),
            returns: vi.fn()
        }

        _local = {
            call: vi.fn(),
            named: vi.fn(),
            toRemote: vi.fn()
        }

        _remote = {
            receive: vi.fn(),
            toLocal: vi.fn()
        }

        // @ts-ignore
        vi.spyOn(Communication, 'Remote').mockImplementation(() => _remote)
        // @ts-ignore
        vi.spyOn(Communication, 'Local').mockImplementation(() => _local)

        let local = new Local()
        let remote = new Remote(local)

        _duplex = new DuplexCallable(local, remote)
    })


    it('should call local remote callables and return result when handle callable request', () => {
        _remote.toLocal.mockReturnValue('local parameter')
        _local.call.mockReturnValue('result')

        _duplex.handle(_sender, {
            id: 'message-id',
            type: 'call',
            callable: 'function-id',
            parameters: ['first', 'second']
        })

        expect(_remote.toLocal).toHaveBeenCalledWith(_sender, 'first')
        expect(_remote.toLocal).toHaveBeenCalledWith(_sender, 'second')
        expect(_local.call).toHaveBeenCalledWith('function-id', 'local parameter', 'local parameter')
        expect(_sender.returns).toHaveBeenCalledWith('message-id', 'result')
    })

    it('should send result to remote invocations when handle callable response', () => {
        _duplex.handle(_sender, {
            id: 'message-id',
            type: 'response',
            response: 'result'
        })

        expect(_remote.receive).toHaveBeenCalledWith(_sender, 'message-id', 'result')
    })
})