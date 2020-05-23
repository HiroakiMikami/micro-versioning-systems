import * as d3 from "d3"

function onReady(callback: () => void): void {
    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", callback)
    } else {
        callback()
    }
}

onReady(() => {
	console.log(d3)
})
