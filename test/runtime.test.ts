import {describe, expect, it} from "vitest";
import Runtime from "../src/runtime";

describe("Solstice runtime", () => {
    it("should not have any extension points when runtime created", () => {
        const runtime = new Runtime()
        expect(runtime.extensionPoints()).toEqual([])
    })

    it("should install extension points from plugin", () => {
        const runtime = new Runtime({
            id: "@core",
            extensionPoints: [{
                name: "buttons",
                validate: (extension: {}) => extension != null
            }],
            extensions: []
        })

        expect(runtime.extensionPoints()).toEqual(["@core/buttons"])
    })

    it("should return empty extensions for undefined extension points", () => {
        const runtime = new Runtime()
        expect(runtime.extensions("@core/undefined")).toEqual([])
    })

    it("should install extensions from plugin", () => {
        const runtime = new Runtime({
            id: "@core",
            extensionPoints: [{
                name: "buttons",
                validate: (extension: {}) => extension != null
            }],
            extensions: [{
                name: "red-button",
                extensionPoint: "@core/buttons"
            }]
        })

        expect(runtime.extensions("@core/buttons")).toEqual([{
            id: "@core/red-button",
            name: "red-button",
            extensionPoint: "@core/buttons"
        }])
    })

    it("should not install extension if extension points undefined", () => {
        const runtime = new Runtime({
            id: "@extension",
            extensionPoints: [],
            extensions: [{
                name: "red-button",
                extensionPoint: "@core/buttons"
            }]
        })
        expect(runtime.extensions("@core/buttons")).toEqual([])
    })
})