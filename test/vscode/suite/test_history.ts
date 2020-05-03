import * as assert from 'assert';

// You can import and use all API from the 'vscode' module
// as well as import your extension to test it
import * as vscode from 'vscode';
import * as path from 'path';
// import * as myExtension from '../../extension';

suite('History', () => {
    vscode.window.showInformationMessage('Start all tests.');
    test('handle insert and delete', async () => {
        const filepath = path.resolve(__dirname, "../../../../test/vscode/fixture", "empty.txt")
        const document = await vscode.workspace.openTextDocument(filepath)
        const editor = await vscode.window.showTextDocument(document)
        const editResponse0 = await editor.edit(editBuilder => {
            editBuilder.insert(new vscode.Position(0, 0), "insert")
        })
        assert.equal(true, editResponse0)

        const commit: ReadonlyArray<string> =
            await vscode.commands.executeCommand("micro-versioning-systems.commit", document)
        assert.equal(1, commit.length)

        await vscode.commands.executeCommand("micro-versioning-systems.toggle", editor, commit[0])
        assert.equal("", document.getText())

        await vscode.commands.executeCommand("micro-versioning-systems.toggle", editor, commit[0])
        assert.equal("insert", document.getText())
    });
    test('handle replace', async () => {
        const filepath = path.resolve(__dirname, "../../../../test/vscode/fixture", "text.txt")
        const document = await vscode.workspace.openTextDocument(filepath)
        const editor = await vscode.window.showTextDocument(document)
        const editResponse0 = await editor.edit(editBuilder => {
            editBuilder.replace(new vscode.Range(new vscode.Position(0, 3), new vscode.Position(0, 6)), "replaced")
        })
        assert.equal(true, editResponse0)

        const commit: ReadonlyArray<string> =
            await vscode.commands.executeCommand("micro-versioning-systems.commit", document)
        assert.equal(1, commit.length)

        await vscode.commands.executeCommand("micro-versioning-systems.toggle", editor, commit[0])
        assert.equal("foobartest\n", document.getText())

        await vscode.commands.executeCommand("micro-versioning-systems.toggle", editor, commit[0])
        assert.equal("fooreplacedtest\n", document.getText())
    });
    test("handle not-commited changes", async () => {
        const filepath = path.resolve(__dirname, "../../../../test/vscode/fixture", "non-commited-changes.txt")
        const document = await vscode.workspace.openTextDocument(filepath)
        const editor = await vscode.window.showTextDocument(document)
        const editResponse0 = await editor.edit(editBuilder => {
            editBuilder.replace(new vscode.Range(new vscode.Position(0, 3), new vscode.Position(0, 6)), "replaced")
        })
        assert.equal(true, editResponse0)

        const commit0: ReadonlyArray<string> =
            await vscode.commands.executeCommand("micro-versioning-systems.commit", document)
        assert.equal(1, commit0.length)
        const editResponse1 = await editor.edit(editBuilder => {
            editBuilder.insert(new vscode.Position(0, 0), "begin")
        })
        assert.equal(true, editResponse1)

        await vscode.commands.executeCommand("micro-versioning-systems.toggle", editor, commit0[0])
        assert.equal("beginfoobartest\n", document.getText())

        const commit1: ReadonlyArray<string> =
            await vscode.commands.executeCommand("micro-versioning-systems.commit", document)
        assert.equal(1, commit1.length)
        await vscode.commands.executeCommand("micro-versioning-systems.toggle", editor, commit1[0])
        assert.equal("foobartest\n", document.getText())
    })
});
