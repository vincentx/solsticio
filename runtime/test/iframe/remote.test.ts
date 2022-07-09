import {beforeEach, describe, expect, it, vi} from 'vitest'
import {CallableResponse, Local, Remote} from '../../src/iframe/communication'
import {v4} from "uuid";

// @vitest-environment jsdom
describe('iFrame communication: Remote', () => {
    let _sandbox: HTMLIFrameElement
    let _remote: Remote
    let _local: Local

    beforeEach(() => {
        _remote = new Remote()
        _local = new Local()

        _sandbox = window.document.createElement('iframe')
        window.document.body.appendChild(_sandbox)

        vi.mock('uuid', () => {
            return {
                v4: vi.fn()
            }
        })

        vi.mocked(v4).mockReturnValueOnce('message-id')
    })

    describe('communicate with remote', () => {
        it('should send message to remote', async () => {
            let message = remoteReceived()

            _remote.send(_sandbox.contentWindow!, requestRemoteCall.bind(this))

            await expect(message).resolves.toEqual({
                id: 'message-id',
                type: 'call',
                callable: 'callable',
                parameters: []
            })
        })

        it('should return received response from remote to sender', async () => {
            remoteReceived().then(_ => _remote.receive(response()))

            await expect(_remote.send(_sandbox.contentWindow!, requestRemoteCall.bind(this))).resolves.toEqual('received')
        })

        it('should throw exception if message id does not match', () => {
            expect(() => _remote.receive(response())).toThrowError('callable not called')
        })

        it('should not return to sender after response received', async () => {
            remoteReceived().then(_ => _remote.receive(response()))

            await _remote.send(_sandbox.contentWindow!, requestRemoteCall.bind(this))

            expect(() => _remote.receive(response())).toThrowError('callable not called')
        })
    })

    describe('restore context from remote', () => {
        it('should restore object from remote context', () => {
            let context = _remote.fromRemote({data: 'data'}, _local, _sandbox.contentWindow!)
            expect(context).toEqual({data: 'data'})
        })

        it('should restore nested object from remote context', () => {
            let context = _remote.fromRemote({nested: {data: 'data'}}, _local, _sandbox.contentWindow!)
            expect(context).toEqual({nested: {data: 'data'}})
        })

        it('should restore array from remote context', () => {
            let context = _remote.fromRemote({array: [1, 2, 3]}, _local, _sandbox.contentWindow!)
            expect(context).toEqual({array: [1, 2, 3]})
        })

        it('should restore function from remote context', async () => {
            let message = remoteReceived()
            let context = _remote.fromRemote({func: {_solstice_id: 'func'}}, _local, _sandbox.contentWindow!)

            context.func('parameter')

            await expect(message).resolves.toEqual(requestRemoteCall('message-id', 'func', 'parameter'))
        })

        it('should pass callback as parameter to function restored from remote context', async () => {
            vi.mocked(v4).mockReset()
            vi.mocked(v4).mockReturnValueOnce('function-id')
            vi.mocked(v4).mockReturnValueOnce('message-id')

            let message = remoteReceived()
            let context = _remote.fromRemote({func: {_solstice_id: 'func'}}, _local, _sandbox.contentWindow!)

            let callback = () => 'callback'
            context.func(callback)

            await expect(message).resolves.toEqual(requestRemoteCall('message-id', 'func', {_solstice_id: 'function-id'}))
        })


        it('should restore function nested in other object from remote context', async () => {
            let message = remoteReceived()
            let context = _remote.fromRemote({nested: {func: {_solstice_id: 'func'}}}, _local, _sandbox.contentWindow!)

            context.nested.func()

            await expect(message).resolves.toEqual(requestRemoteCall('message-id', 'func'))
        })
    })

    function requestRemoteCall(id: string, callable: string = 'callable', ...parameters: any[]) {
        return {id: id, type: 'call', callable: callable, parameters: parameters}
    }

    function response(id: string = 'message-id', response: any = 'received'): CallableResponse {
        return {id: id, type: 'response', response: response}
    }

    function remoteReceived() {
        return new Promise<any>((resolve) => {
            _sandbox.contentWindow!.addEventListener('message', (e) => resolve(e.data), {once: true})
        })
    }
})