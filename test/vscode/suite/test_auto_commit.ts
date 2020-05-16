import * as assert from 'assert';

import * as vscode from 'vscode';
import * as path from 'path';

function sleep(msec: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, msec))
}

suite('Auto commit', () => {
    test('commit the changes after file save', async () => {
        const settings = vscode.workspace.getConfiguration("microVersioningSystems");
        settings.update("commitTimeout", 500)

        const filepath = path.resolve(__dirname, "../../../../test/vscode/fixture", "empty-for-autocommit0.txt")
        const document = await vscode.workspace.openTextDocument(filepath)
        const editor = await vscode.window.showTextDocument(document)
        const editResponse0 = await editor.edit(editBuilder => {
            editBuilder.insert(new vscode.Position(0, 0), "insert")
        })
        assert.equal(true, editResponse0)
        await editor.document.save()
        await sleep(1000)

        const commit: ReadonlyArray<string> =
            await vscode.commands.executeCommand("micro-versioning-systems.commit", document)
        assert.equal(0, commit.length)

        await editor.edit(editBuilder => {
            editBuilder.delete(new vscode.Range(new vscode.Position(0, 0), new vscode.Position(0, "insert".length)))
        })
        await editor.document.save()
    });
    test('do not commit if the file changed', async () => {
        const settings = vscode.workspace.getConfiguration("microVersioningSystems");
        settings.update("commitTimeout", 500)

        const filepath = path.resolve(__dirname, "../../../../test/vscode/fixture", "empty-for-autocommit1.txt")
        const document = await vscode.workspace.openTextDocument(filepath)
        const editor = await vscode.window.showTextDocument(document)
        const editResponse0 = await editor.edit(editBuilder => {
            editBuilder.insert(new vscode.Position(0, 0), "insert")
        })
        assert.equal(true, editResponse0)
        await editor.document.save()
        await sleep(250)
        await editor.edit(editBuilder => {
            editBuilder.insert(new vscode.Position(0, 0), "x")
        })
        await sleep(250)

        const commit: ReadonlyArray<string> =
            await vscode.commands.executeCommand("micro-versioning-systems.commit", document)
        assert.equal(1, commit.length)
        await editor.edit(editBuilder => {
            editBuilder.delete(new vscode.Range(new vscode.Position(0, 0), new vscode.Position(0, "xinsert".length)))
        })
        await editor.document.save()
    });
});
