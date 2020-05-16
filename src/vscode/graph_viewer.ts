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
				localResourceRoots: [vscode.Uri.file(path.join(extensionPath, "resources"))]
			}
		)
		this.panel.webview.html = content;
	}
	static async readContent(extensionPath: string) {
		return await promisify(fs.readFile)(path.join(extensionPath, "resources", "graph_viewer.html"), "utf8")
		
	}
}