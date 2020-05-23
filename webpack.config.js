const path = require("path")

module.exports = {
	entry: { bundle: path.resolve(__dirname, "out", "src", "vscode", "graphView", "main.js") },
	output: {
		path: path.resolve(__dirname, "out", "src", "vscode", "graphView"),
		filename: "[name].js"
	},
	devtool: "source-map",
	mode: "development"
}
