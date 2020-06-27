import * as vscode from "vscode"
import * as path from "path"
import * as fs from "fs"
import { promisify } from 'util'
import { Status } from '../common';
import { Commit, CommitHistory, Relation } from '../commit';
import { toggle } from './extension';

export class SerializableCommit {
    public readonly id: string;
    public readonly lastTimeStamp: Date;
    public readonly remove: string;
    public readonly insert: string;
    public readonly status: Status;
    constructor(id: string, commit: Commit, history: CommitHistory) {
        this.id = id;
        const timestamps = Array.from(commit.timestamps)
        this.lastTimeStamp = Math.max.apply(null, timestamps)
        this.remove = commit.remove.map(segmentId => {
            return history.history.segments.get(segmentId).text
        }).join("")
        this.insert = commit.insert.map(segmentId => {
            return history.history.segments.get(segmentId).text
        }).join("")
        this.status = commit.status
    }
}
export class SerializableRelation {
    constructor (public source: string, public target: string, public relation: Relation) {}
}
export class SerializableHistory {
    public readonly commits: ReadonlyArray<SerializableCommit>;
    public readonly edges: ReadonlyArray<SerializableRelation>;

    constructor(history: CommitHistory) {
        this.commits = Array.from(history.commits).map(elem => {
            return new SerializableCommit(elem[0], elem[1], history)
        })
        let edges: ReadonlyArray<SerializableRelation> = []
        history.relation.edges.forEach((value, from) => {
            edges = edges.concat(Array.from(value).map(elem => {
                return new SerializableRelation(from, elem[0], elem[1])
            }))
        })
        this.edges = edges
    }
}

export class GraphViewerPanel {
    private readonly panel: vscode.WebviewPanel
    private readonly disposables: vscode.Disposable[]

    constructor(document: vscode.TextDocument, extensionPath: string, content: string) {
        const column = vscode.window.activeTextEditor
            ? vscode.window.activeTextEditor.viewColumn
            : vscode.ViewColumn.One

        this.disposables = []
        this.panel = vscode.window.createWebviewPanel(
            "", `History of ${document.uri.fsPath}`, column,
            {
                enableScripts: true,
                localResourceRoots: [
                    vscode.Uri.file(path.join(extensionPath, "resources")),
                    vscode.Uri.file(path.join(extensionPath, "out", "src", "vscode", "graphView")),
                ]
            }
        )
        this.panel.webview.html = content;
		this.panel.onDidDispose(() => this.dispose(), null, this.disposables);
        this.panel.webview.onDidReceiveMessage(async message => {
            vscode.window.showInformationMessage(`toggle the commit ${message.id}`)
            await toggle(document, message.id)
        }, null, this.disposables)
    }
    async update(history: CommitHistory): Promise<void> {
        await this.panel.webview.postMessage({ "method": "update", "body": new SerializableHistory(history) })
        return
    }
	public dispose(): void {
		// Clean up our resources
		this.panel.dispose();

        for (const disposable of this.disposables) {
            disposable.dispose()
        }
	}
    static async readContent(context: vscode.ExtensionContext): Promise<string> {
        let content = await promisify(fs.readFile)(context.asAbsolutePath(path.join("resources", "graph_viewer.html")), "utf8")
        const scriptDir = vscode.Uri.file(context.asAbsolutePath(path.join("out", "src", "vscode", "graphView")))
        content = content.replace("{script-dir}", scriptDir.with({ scheme: "vscode-resource" }).toString(true))

        return content

    }
}