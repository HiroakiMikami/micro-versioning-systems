import * as vscode from "vscode"
import * as path from "path"
import * as fs from "fs"
import { promisify } from 'util'

export class GraphViewerPanel {
	private readonly panel: vscode.WebviewPanel
	// private readonly disposables: vscode.Disposable[]

	constructor(uri: string, extensionPath: string, content: string) {
		const column = vscode.window.activeTextEditor
			? vscode.window.activeTextEditor.viewColumn
			: vscode.ViewColumn.One

		// this.disposables = []
		this.panel = vscode.window.createWebviewPanel(
			"", `History of ${uri}`, column,
			{
				enableScripts: true,
				localResourceRoots: [
                    vscode.Uri.file(path.join(extensionPath, "resources")),
                    vscode.Uri.file(path.join(extensionPath, "out", "src", "vscode", "graphView")),
                ]
			}
		)
		this.panel.webview.html = content;
	}
    static async readContent(context: vscode.ExtensionContext): Promise<string> {
		let content = await promisify(fs.readFile)(context.asAbsolutePath(path.join("resources", "graph_viewer.html")), "utf8")
		const scriptDir = vscode.Uri.file(context.asAbsolutePath(path.join("out", "src", "vscode", "graphView")))
        content = content.replace("{script-dir}", scriptDir.with({ scheme: "vscode-resource" }).toString(true))

		return content

	}
}