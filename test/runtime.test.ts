import {describe, expect, it} from "vitest";
import Runtime from "../src/runtime";

describe("Solstice runtime", () => {
    it("should not have any extension points when runtime created", () => {
        const runtime = new Runtime()
        expect(runtime.extensionPoints()).toEqual([])
    })

    it("should install extension points from plugin", () => {
        const runtime = new Runtime()
        runtime.install({
            id: "@core",
            extensionPoints: [{
                id: "buttons",
                validate: (extension: {}) => extension != null
            }]
        })

        expect(runtime.extensionPoints()).toEqual(["@core/buttons"])
    })

    it.skip("should return empty extensions for undefined extension points")
    it.skip("should install extensions from plugin")

    it.skip("should install get installed extensions for extension points")
})