// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { CommitHistory, FailToResolveDependency } from '../commit';
import { SegmentHistory } from '../segment';
import { ImmutableDirectedGraph } from '../graph';
import { Diff, Delta, DeleteNonExistingText, ModifyAlreadyModifiedText } from '../diff';
import { GraphViewerPanel } from "./graph_viewer"

class State {
    public constructor(public text: string,
                       public history: CommitHistory,
                       public change: Diff | null,
                       public modifiedAfterSave: boolean) { }
}
const states = new Map<string, State>();

function createEmptyStateIfNeeded(document: vscode.TextDocument) { 
    if (!states.has(document.uri.fsPath)) {
        const empty = new CommitHistory(
            new SegmentHistory(new Map(), new ImmutableDirectedGraph(new Set(), new Map()), ""),
            new Map(),
            new ImmutableDirectedGraph(new Set(), new Map()));
        const result = empty.applyDiff(new Date(), new Diff([new Delta(0, "", document.getText())]))
        if (result instanceof DeleteNonExistingText) {
            vscode.window.showErrorMessage(
                `Error during initializing the state for ${document.uri.fsPath}: ` +
                `Delete non-existing text: ${result.offset}: expected=${result.expected}, actual=${result.actual}`
            )
            return
        }
        states.set(document.uri.fsPath, new State(document.getText(), result.newHistory, null, false));
    }
}
export function commit(document: vscode.TextDocument): ReadonlyArray<string> {
    createEmptyStateIfNeeded(document)
    const state = states.get(document.uri.fsPath)
    if (state.change === null) {
        vscode.window.showWarningMessage(`There is no change in ${document.uri.fsPath}`)
        return []
    }
    const result = state.history.applyDiff(new Date(), state.change)
    if (result instanceof DeleteNonExistingText) {
        vscode.window.showErrorMessage(
            `Error during commit for ${document.uri.fsPath}: ` +
            `Delete non-existing text: ${result.offset}: expected=${result.expected}, actual=${result.actual}`
        )
        return []
    }

    // Update state
    state.change = null
    state.history = result.newHistory
    state.text = document.getText()
    return Array.from(result.newCommits)
}
export async function toggle(editor: vscode.TextEditor, commit: string) {
    const document = editor.document
    createEmptyStateIfNeeded(document)
    const state = states.get(document.uri.fsPath)
    const result = state.history.toggle(commit)
    if (result instanceof DeleteNonExistingText) {
        vscode.window.showErrorMessage(
            `Error during toggle for ${document.uri.fsPath}: ` +
            `Delete non-existing text: ${result.offset}: expected=${result.expected}, actual=${result.actual}`
        )
        return
    }
    if (result instanceof FailToResolveDependency) {
        vscode.window.showErrorMessage(
            `Error during toggle for ${document.uri.fsPath}: ` + 
            `Fail to resolve dependency: ${result.commit}`
        )
        return
    }
    let diff = result.diff
    let d1 = null
    if (state.change != null) {
        const d0 = diff.rebase(state.change)
        d1 = state.change.rebase(diff)
        if (d0 instanceof ModifyAlreadyModifiedText) {
            vscode.window.showErrorMessage(
                `Error during toggle for ${document.uri.fsPath}: ` +
                `Modified already modifed text: ${d0.offset} ${d0.text}`
            )
            return
        }
        if (d1 instanceof ModifyAlreadyModifiedText) {
            vscode.window.showErrorMessage(
                `Error during toggle for ${document.uri.fsPath}: ` +
                `Modified already modifed text: ${d1.offset} ${d1.text}`
            )
            return
        }
        diff = d0
    }
    
    // Apply edit
    await editor.edit(editBuilder => {
        for (const delta of diff.deltas) {
            if (delta.insert.length !== 0 && delta.remove.length !== 0) {
                // Replace
                editBuilder.replace(new vscode.Range(
                    document.positionAt(delta.offset),
                    document.positionAt(delta.offset + delta.remove.length)
                ), delta.insert)
            } else if (delta.insert.length !== 0) {
                // Insert
                editBuilder.insert(document.positionAt(delta.offset), delta.insert)
            } else {
                // Remove
                editBuilder.delete(new vscode.Range(
                    document.positionAt(delta.offset),
                    document.positionAt(delta.offset + delta.remove.length)
                ))
            }
        }
    })
    // Update state
    state.history = result.newHistory
    state.text = document.getText()
    state.change = d1
}

export function activate(context: vscode.ExtensionContext) {
    // Initialize state
    for (const document of vscode.workspace.textDocuments) {
        createEmptyStateIfNeeded(document)
    }
    context.subscriptions.push(vscode.workspace.onDidOpenTextDocument(e => {
        createEmptyStateIfNeeded(e)
    }))
    context.subscriptions.push(vscode.workspace.onDidSaveTextDocument(e => {
        commit(e)
    }))

    // Update diff when changing the text document
    context.subscriptions.push(vscode.workspace.onDidChangeTextDocument(e => {
        if (!states.has(e.document.uri.fsPath)) {
            vscode.window.showErrorMessage(
                `VSCode does not have the state for ${e.document.uri.fsPath}`)
        }
        const diff = new Diff(e.contentChanges.map(change => {
            return new Delta(change.rangeOffset,
                states.get(e.document.uri.fsPath).text.substr(change.rangeOffset, change.rangeLength),
                change.text)
        }))

        const oldDiff = states.get(e.document.uri.fsPath).change || new Diff([])
        const newDiff = oldDiff.then(diff)
        if (newDiff instanceof DeleteNonExistingText) {
            vscode.window.showErrorMessage(
                `Error during updating the changes for ${e.document.uri.fsPath}: ` +
                `Delete non-existing text: ${newDiff.offset}: expected=${newDiff.expected}, actual=${newDiff.actual}`
            )
        } else {
            states.get(e.document.uri.fsPath).change = newDiff
        }
        states.get(e.document.uri.fsPath).modifiedAfterSave = true
    }))
    context.subscriptions.push(vscode.workspace.onDidSaveTextDocument(e => {
        if (!states.has(e.uri.fsPath)) {
            vscode.window.showErrorMessage(
                `VSCode does not have the state for ${e.uri.fsPath}`)
        }
        const timeoutMs = vscode.workspace.getConfiguration("microVersioningSystems").commitTimeout
        const state = states.get(e.uri.fsPath)
        if (state.modifiedAfterSave) {
            state.modifiedAfterSave = false;
        }
        setTimeout(() => {
            if (!state.modifiedAfterSave) {
                // commit
                commit(e)
            }
        }, timeoutMs)
    }))

    context.subscriptions.push(vscode.commands.registerCommand(
        'micro-versioning-systems.commit', document => commit(document)
    ))
    context.subscriptions.push(vscode.commands.registerCommand(
        'micro-versioning-systems.toggle', async (editor, commit) => {
            await toggle(editor, commit)
        }
    ))

    // View Graph
	context.subscriptions.push(
		vscode.commands.registerCommand('microVersioningSystems.viewGraph', async () => {
            const content = await GraphViewerPanel.readContent(context)
            const editor = vscode.window.activeTextEditor
            if (editor != null) {
                if (!states.has(editor.document.uri.fsPath)) {
                    vscode.window.showErrorMessage(
                        `VSCode does not have the state for ${editor.document.uri.fsPath}`)
                }
                const state = states.get(editor.document.uri.fsPath)
                // TODO close
                const panel = new GraphViewerPanel(editor.document, context.extensionPath, content)
                panel.update(state.history)
            }
		})
	);
}

// this method is called when your extension is deactivated
export function deactivate() { }
