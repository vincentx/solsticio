import {beforeEach, describe, expect, it, vi} from 'vitest'
import {CallableResponse, Remote} from '../../src/iframe/communication'
import {v4} from "uuid";

// @vitest-environment jsdom
describe('iFrame communication: Remote', () => {
    let _sandbox: HTMLIFrameElement
    let _remote: Remote

    beforeEach(() => {
        _remote = new Remote()

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

            await expect(message).resolves.toEqual({id: 'message-id', type: 'call', callable: 'callable'})
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

    function requestRemoteCall(id: string) {
        return {id: id, type: 'call', callable: 'callable'}
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