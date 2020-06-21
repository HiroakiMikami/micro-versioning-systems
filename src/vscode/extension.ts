// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { CommitHistory, FailToResolveDependency } from '../commit';
import { SegmentHistory } from '../segment';
import { ImmutableDirectedGraph } from '../graph';
import { Diff, Delta, DeleteNonExistingText, ModifyAlreadyModifiedText } from '../diff';
import { GraphViewerPanel } from "./graph_viewer"
import { evaluate } from '../score';
import { Status } from '../common';

class State {
    private scores: ReadonlyMap<string, number>
    public constructor(public text: string,
        private history: CommitHistory,
        public change: Diff | null,
        public modifiedAfterSave: boolean) {
        this.scores = evaluate(history.commits)
    }

    public getHistory(): CommitHistory {
        return this.history
    }
    public getScores(): ReadonlyMap<string, number> {
        return this.scores
    }
    public setHistory(history: CommitHistory, document: vscode.TextDocument): void {
        this.history = history
        this.scores = evaluate(this.history.commits)
        candidateUpdater.updateCandidates(document)
        codeLensProvider.onDidChangeCodeLensesEmitter.fire()
    }
}
const states = new Map<string, State>();
function createEmptyStateIfNeeded(document: vscode.TextDocument): void {
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
    const result = state.getHistory().applyDiff(new Date(), state.change)
    if (result instanceof DeleteNonExistingText) {
        vscode.window.showErrorMessage(
            `Error during commit for ${document.uri.fsPath}: ` +
            `Delete non-existing text: ${result.offset}: expected=${result.expected}, actual=${result.actual}`
        )
        return []
    }

    // Update state
    state.change = null
    state.setHistory(result.newHistory, document)
    state.text = document.getText()
    return Array.from(result.newCommits)
}
export async function toggle(document: vscode.TextDocument, commit: string): Promise<void> {
    const editor = await vscode.window.showTextDocument(document)
    createEmptyStateIfNeeded(document)
    const state = states.get(document.uri.fsPath)
    const result = state.getHistory().toggle(commit)
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
    state.setHistory(result.newHistory, document)
    state.text = document.getText()
    state.change = d1
    return
}

class Candidate {
    public constructor(public readonly document: vscode.TextDocument,
                       public readonly range: vscode.Range,
                       public readonly commitId: string,
                       public readonly diff: Diff) {}
}

let candidateUpdater: CandidatesUpdater = null
class CandidatesUpdater {
    private candidates: Array<Candidate>
    constructor() {
        this.candidates = []
    }
    public getCandidates(): ReadonlyArray<Candidate> {
        return this.candidates;
    }

    updateCandidates(document: vscode.TextDocument): void {
        createEmptyStateIfNeeded(document)
        this.candidates = []
        const state = states.get(document.uri.fsPath)
        const scores = Array.from(state.getScores())
        scores.sort((x, y) => {
            if (x[1] < y[1]) {
                return 1
            } else if (x[1] > y[1]) {
                return -1;
            } else {
                return 0;
            }
        })
        let numCandidates = vscode.workspace.getConfiguration("microVersioningSystems").numCandidates
        numCandidates = Math.min(numCandidates, scores.length)
        for (let i = 0; i < numCandidates; ++i) {
            const commitId = scores[i][0];
            const commit = state.getHistory().commits.get(commitId)
            let minOffset = state.text.length
            let maxOffset = 0
            for (const segmentId of commit.remove) {
                const segment = state.getHistory().history.segments.get(segmentId)
                minOffset = Math.min(minOffset, segment.offset)
                maxOffset = Math.max(maxOffset, segment.offset)
                if (segment.status == Status.Enabled) {
                    maxOffset = Math.max(maxOffset, segment.offset + segment.text.length)
                }
            }
            for (const segmentId of commit.insert) {
                const segment = state.getHistory().history.segments.get(segmentId)
                minOffset = Math.min(minOffset, segment.offset)
                maxOffset = Math.max(maxOffset, segment.offset)
                if (segment.status == Status.Enabled) {
                    maxOffset = Math.max(maxOffset, segment.offset + segment.text.length)
                }
            }
            const range = new vscode.Range(document.positionAt(minOffset), document.positionAt(maxOffset))
            const result = state.getHistory().toggle(commitId)
            if (result instanceof DeleteNonExistingText) {
                vscode.window.showErrorMessage(
                    `Error during toggle for ${document.uri.fsPath}: ` +
                    `Delete non-existing text: ${result.offset}: expected=${result.expected}, actual=${result.actual}`
                )
                continue
            }
            if (result instanceof FailToResolveDependency) {
                vscode.window.showErrorMessage(
                    `Error during toggle for ${document.uri.fsPath}: ` +
                    `Fail to resolve dependency: ${result.commit}`
                )
                continue
            }
            this.candidates.push(new Candidate(document, range, commitId, result.diff))
        }
    }
}

let _context: vscode.ExtensionContext = null
let codeLensProvider: CandidateCodeLensProvider = null
class CandidateCodeLensProvider implements vscode.CodeLensProvider {
    private _codeLenses: Array<vscode.CodeLens>;
    public readonly onDidChangeCodeLensesEmitter = new vscode.EventEmitter<void>()
    public readonly onDidChangeCodeLenses?: vscode.Event<void> = this.onDidChangeCodeLensesEmitter.event
    constructor() {
        this._codeLenses = []
        vscode.workspace.onDidChangeConfiguration((_) => {
            this.onDidChangeCodeLensesEmitter.fire();
        });
    }
    public getCodeLenses(): ReadonlyArray<vscode.CodeLens> {
        return this._codeLenses;
    }
    provideCodeLenses(document: vscode.TextDocument, token: vscode.CancellationToken): vscode.ProviderResult<vscode.CodeLens[]> {
        createEmptyStateIfNeeded(document)
        const state = states.get(document.uri.fsPath)
        const scores = Array.from(state.getScores())
        scores.sort((x, y) => {
            if (x[1] < y[1]) {
                return 1
            } else if (x[1] > y[1]) {
                return -1;
            } else {
                return 0;
            }
        })
        let numCandidates = vscode.workspace.getConfiguration("microVersioningSystems").numCandidates
        for (let i = candidateHoverProviders.length; i < numCandidates; ++i) {
            const provider = new CandidateHoverProvider(i);
            _context.subscriptions.push(vscode.languages.registerHoverProvider(
                "*", provider))
            candidateHoverProviders.push(provider)
        }
        
        numCandidates = Math.min(numCandidates, scores.length)
        let codeLenses = []
        for (const candidate of candidateUpdater.getCandidates()) {
            codeLenses.push(new vscode.CodeLens(
                candidate.range,
                {
                    title: "micro-versioning-systems:toggle",
                    command: "micro-versioning-systems.moveto",
                    arguments: [document, candidate.range]
                }));
        }
        return codeLenses;
    }
    resolveCodeLens?(codeLens: vscode.CodeLens, token: vscode.CancellationToken): vscode.ProviderResult<vscode.CodeLens> {
        return codeLens
    }
}

let candidateHoverProviders: Array<CandidateHoverProvider> = []
let showHover = true
class CandidateHoverProvider implements vscode.HoverProvider {
    public constructor(private index: number) {}
    provideHover(document: vscode.TextDocument, position: vscode.Position,
                 token: vscode.CancellationToken): vscode.ProviderResult<vscode.Hover> {
        if (!showHover) {
            return null
        }
        const candidates = candidateUpdater.getCandidates()
        if (candidates.length <= this.index) {
            return null;
        }
        const candidate = candidates[this.index]
        if (candidate.range.start.line <= position.line && position.line <= candidate.range.end.line) {
            const args = [document.uri.fsPath, candidate.commitId];
    
            const commandUri = vscode.Uri.parse(
                `command:micro-versioning-systems.toggle?${encodeURIComponent(JSON.stringify(args))}`
            );
            let diff = []
            for (const delta of candidate.diff.deltas) {
                // TODO pre
                diff.push(
                    `${("    " + delta.offset).substr(-4)}: ${delta.remove} \u21D2 ${delta.insert}`)
            }
            const contents = new vscode.MarkdownString(
                `### [Toggle ${candidate.commitId}](${commandUri})\n` +
                `\n` +
                `#### Diff\n` +
                `\n` +
                diff.join("\n")
            )
            contents.isTrusted = true;
            return new vscode.Hover(contents)
        }
        return null;
    }
}

export function activate(context: vscode.ExtensionContext): void {
    // Initialize state
    for (const document of vscode.workspace.textDocuments) {
        createEmptyStateIfNeeded(document)
    }
    _context = context
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
        'micro-versioning-systems.toggle', async (uri, commit) => {
            const document = await vscode.workspace.openTextDocument(uri)
            await toggle(document, commit)
        }
    ))
    context.subscriptions.push(vscode.commands.registerCommand(
        'micro-versioning-systems.moveto', async (document, range: vscode.Range) => {
            const editor = await vscode.window.showTextDocument(document)
            showHover = true;
            editor.selections = [new vscode.Selection(range.start, range.end)]
        }
    ))

    candidateUpdater = new CandidatesUpdater()
    codeLensProvider = new CandidateCodeLensProvider()
    context.subscriptions.push(vscode.languages.registerCodeLensProvider(
        "*", codeLensProvider
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
                panel.update(state.getHistory())
            }
        })
    );
    // Toggle hover
    context.subscriptions.push(vscode.commands.registerCommand(
        'microVersioningSystems.toggleCandidatesHover', async () => {
            showHover = !showHover
        }
    ))
}

// this method is called when your extension is deactivated
export function deactivate(): void {
    vscode.window.showInformationMessage("Deactivate micro-versioning systems")
}
