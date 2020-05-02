// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { CommitHistory } from '../commit';
import { SegmentHistory } from '../segment';
import { ImmutableDirectedGraph } from '../graph';
import { Diff, Delta, DeleteNonExistingText } from '../diff';

class State {
    public constructor(public text: string,
                       public history: CommitHistory,
                       public change?: Diff) { }
}
const states = new Map<string, State>();

function createEmptyStateIfNeeded(document: vscode.TextDocument) { 
    if (!states.has(document.uri.fsPath)) {
        const empty = new CommitHistory(
            new SegmentHistory(new Map(), new ImmutableDirectedGraph(new Set(), new Map()), ""),
            new Map(),
            new ImmutableDirectedGraph(new Set(), new Map()));
        states.set(document.uri.fsPath, new State(document.getText(), empty));
    }
}

export function activate(context: vscode.ExtensionContext) {
    // Initialize state
    for (const document of vscode.workspace.textDocuments) {
        createEmptyStateIfNeeded(document)
    }
    context.subscriptions.push(vscode.workspace.onDidOpenTextDocument(e => {
        createEmptyStateIfNeeded(e)
    }))

    // Update diff when changing the text document
    context.subscriptions.push(vscode.workspace.onDidChangeTextDocument(e => {
        if (!states.has(e.document.uri.fsPath)) {
            // TODO error message
        }
        const diff = new Diff(e.contentChanges.map(change => {
            return new Delta(change.rangeOffset,
                states.get(e.document.uri.fsPath).text.substr(change.rangeOffset, change.rangeLength),
                change.text)
        }))

        const oldDiff = states.get(e.document.uri.fsPath).change || new Diff([])
        const newDiff = oldDiff.then(diff)
        if (newDiff instanceof DeleteNonExistingText) {
            // TODO error dialog
        } else {
            states.get(e.document.uri.fsPath).change = newDiff
        }
    }))

	/*
	// The command has been defined in the package.json file
	// Now provide the implementation of the command with registerCommand
	// The commandId parameter must match the command field in package.json
	let disposable = vscode.commands.registerCommand('extension.helloWorld', () => {
		// The code you place here will be executed every time your command is executed

		// Display a message box to the user
		vscode.window.showInformationMessage('Hello World!');
	});

	context.subscriptions.push(disposable);
	*/
}

// this method is called when your extension is deactivated
export function deactivate() { }
