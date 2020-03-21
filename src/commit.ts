import * as uuidv4 from "uuid/v4"

import { ConstrainedData, Status, Operation } from "./common"
import { Diff, DeleteNonExistingText } from "./diff"
import { SegmentHistory } from "./segment"
import { ImmutableDirectedGraph, toMutable, toImmutable, MutableDirectedGraph } from "./graph"

/**
 * An edit of the source code
 *
 * @see https://doi.org/10.1145/3025453.3025597
 */
class Commit extends ConstrainedData {
    /**
     * @param remove The deleted segments
     * @param insert The inserted segments
     * @param timestamps The set of timestamps that this commit was updated
     * @param status The current status
     */
    constructor(public readonly remove: ReadonlyArray<string>,
        public readonly insert: ReadonlyArray<string>,
        public readonly timestamps: ReadonlySet<Date>,
        public readonly status: Status) {
        super(() => {
            /* remove and insert have no intersection */
            const ids = new Set(remove.concat(insert))
            if (ids.size === 0) {
                return `there are no segments in this commit`
            }
            if (ids.size !== remove.length + insert.length) {
                return `there are some duplicated segments`
            }

            /* timestamps should not be empty */
            if (timestamps.size === 0) {
                return `the set of timestamps is empty`
            }

            return null
        })
    }
    /**
     * @returns The list of segment operations required to toggle this commit
     */
    public toggle(): ReadonlyArray<[Operation, string]> {
        const retval: [Operation, string][] = []
        if (this.status === Status.Enabled) {
            for (const id of this.remove) {
                retval.push([Operation.Enable, id])
            }
            for (const id of this.insert) {
                retval.push([Operation.Disable, id])
            }
        } else {
            for (const id of this.insert) {
                retval.push([Operation.Enable, id])
            }
            for (const id of this.remove) {
                retval.push([Operation.Disable, id])
            }
        }
        retval.reverse()
        return retval
    }
}

/** Relation between two commits */
enum Relation { Depend, Exclusive }

/** A result of the operation */
class Result {
    /**
     * @param newHistory The new history
     * @param diff The difference between the previous source code and the text of `newHistory`
     * @param newCommits The set of commits that are added by the operation
     */
    public constructor(public readonly newHistory: CommitHistory,
        public readonly diff: Diff,
        public readonly newCommits: ReadonlySet<string>) { }
}

/** A conflict occurred when failing to resolve dependencies between commits */
class FailToResolveDependency {
    /**
     * @param commit The commit failed to resolve dependency
     */
    public constructor(public readonly commit: string) { }
}

/**
 * A source code history that uses commits
 *
 * @see https://doi.org/10.1145/3025453.3025597
 */
class CommitHistory extends ConstrainedData {
    /** The inverse graph of the relation */
    private inverseRelation: ImmutableDirectedGraph<string, Relation>
    /**
     * @param history The current segment history
     * @param commits The set of commits
     * @param relation The relation between commits
     * @param _inverseRelation The inverse graph of the relation (automatically computed if this argument is null or undefined)
     */
    constructor(public readonly history: SegmentHistory, public readonly commits: ReadonlyMap<string, Commit>,
        public readonly relation: ImmutableDirectedGraph<string, Relation>,
        _inverseRelation?: ImmutableDirectedGraph<string, Relation>) {
        super(() => {
            if (_inverseRelation) {
                /* Check inverseRelation */
                for (const v of relation.vertices) {
                    for (const [v2, l] of relation.successors(v)) {
                        if (_inverseRelation.successors(v2).get(v) !== l) {
                            return `The inverse-relation does not contains ${v} -> ${v2} with label ${l}`
                        }
                    }
                }
                for (const v of relation.vertices) {
                    for (const [v2, l] of _inverseRelation.successors(v)) {
                        if (relation.successors(v2).get(v) !== l) {
                            return `The inverse-relation contains the invalid edge ${v2} -> ${v} with label ${l}`
                        }
                    }
                }
            }

            /* the segments in the commits should be contained in the segment-history */
            for (const [commitId, commit] of commits) {
                for (const segmentId of commit.remove.concat(commit.insert)) {
                    if (!history.segments.has(segmentId)) {
                        return `The ${commitId} commit contains the ${segmentId} segment, but the segment-history does not contain it.`
                    }
                }
            }

            /* the vertices of the relation should be a subset of the commits */
            for (const commitId of relation.vertices) {
                if (!commits.has(commitId)) {
                    return `the ${commitId} commit has a relation, but it is not found.`
                }
            }

            /* there are exclusive relations iff the deleted segments two commits are overlapped */
            for (const [commitId1, commit1] of commits) {
                const d1 = new Set(commit1.remove)
                for (const [commitId2, commit2] of commits) {
                    if (commitId1 === commitId2) continue

                    if (commit2.remove.some(x => d1.has(x))) {
                        // Overlapped
                        if (relation.successors(commitId1).get(commitId2) === Relation.Exclusive &&
                            relation.successors(commitId2).get(commitId1) === Relation.Exclusive) {
                            // Exclusive => OK
                        } else {
                            return `The commit ${commitId1} and ${commitId2} should be exclusive`
                        }
                    } else {
                        if (relation.successors(commitId1).get(commitId2) === Relation.Exclusive &&
                            relation.successors(commitId2).get(commitId1) === Relation.Exclusive) {
                            // Exclusive
                            return `The commit ${commitId1} and ${commitId2} should not be exclusive`
                        }
                    }
                }
            }
            return null
        })

        if (_inverseRelation) {
            this.inverseRelation = _inverseRelation
        } else {
            const g = new MutableDirectedGraph<string, Relation>(new Set(relation.vertices), new Map())
            for (const v of relation.vertices) {
                for (const [v2, l] of relation.successors(v)) {
                    g.addEdge(v2, v, l)
                }
            }
            this.inverseRelation = toImmutable(g)
        }
    }
    /**
     * Apply the diff to the history
     * @param date The date of this change
     * @param diff The change of the source code
     * @returns The result of this operation
     */
    public applyDiff(date: Date, diff: Diff): Result | DeleteNonExistingText {
        const deltas = Array.from(diff.deltas)
        deltas.reverse()

        let newHistory = this.history
        const newCommits = new Map(Array.from(this.commits))
        const addedCommits: Set<string> = new Set()
        const newRelation = toMutable(this.relation)
        const newInverseRelation = toMutable(this.inverseRelation)

        function mkId(): string {
            let id = uuidv4()
            while (newCommits.has(id)) {
                id = uuidv4()
            }
            return id
        }

        for (const delta of deltas) {
            const result = newHistory.applyDeleta(delta)
            if (result instanceof DeleteNonExistingText) {
                return result
            }

            const commit =
                new Commit(result.remove, result.insert, new Set([date]), Status.Enabled)
            const toBeRemoved = new Set(result.remove)
            const id = mkId()

            for (const [id2, c] of newCommits) {
                let hasRegionalConflict = false
                let isExclusive = false
                const remove = []
                const insert = []
                for (const r of c.remove) {
                    /* Update splitted commits */
                    if (result.splittedSegments.has(r)) {
                        for (const s of result.splittedSegments.get(r)) {
                            remove.push(s)
                        }
                    } else {
                        remove.push(r)
                    }

                    /* Check exclusive relation */
                    if (toBeRemoved.has(r)) {
                        isExclusive = true
                    }

                    /* Check regional conflict */
                    const interval = newHistory.segments.get(r).interval()
                    if (delta.interval().intersect(interval) !== null) {
                        hasRegionalConflict = true
                    }
                }
                for (const i of c.insert) {
                    /* Update splitted commits */
                    if (result.splittedSegments.has(i)) {
                        for (const s of result.splittedSegments.get(i)) {
                            insert.push(s)
                        }
                    } else {
                        insert.push(i)
                    }

                    /* Check regional conflict */
                    const interval = newHistory.segments.get(i).interval()
                    if (delta.interval().intersect(interval) !== null) {
                        hasRegionalConflict = true
                    }
                }

                if (isExclusive) {
                    newRelation.addVertex(id)
                    newRelation.addVertex(id2)
                    newRelation.addEdge(id, id2, Relation.Exclusive)
                    newRelation.addEdge(id2, id, Relation.Exclusive)
                    newInverseRelation.addVertex(id)
                    newInverseRelation.addVertex(id2)
                    newInverseRelation.addEdge(id, id2, Relation.Exclusive)
                    newInverseRelation.addEdge(id2, id, Relation.Exclusive)
                } else if (hasRegionalConflict) {
                    newRelation.addVertex(id)
                    newRelation.addVertex(id2)
                    newRelation.addEdge(id2, id, Relation.Depend)
                    newInverseRelation.addVertex(id)
                    newInverseRelation.addVertex(id2)
                    newInverseRelation.addEdge(id, id2, Relation.Depend)
                }

                /* update local variables */
                newCommits.set(id2, new Commit(remove, insert, c.timestamps, c.status))
            }

            newHistory = result.newHistory
            newCommits.set(id, commit)
            addedCommits.add(id)
        }

        /* Add dependency */
        for (const c1 of addedCommits) {
            newRelation.addVertex(c1)
            newInverseRelation.addVertex(c1)
            for (const c2 of addedCommits) {
                if (c1 === c2) continue

                newRelation.addVertex(c2)
                newRelation.addEdge(c1, c2, Relation.Depend)
                newInverseRelation.addVertex(c2)
                newInverseRelation.addEdge(c1, c2, Relation.Depend)
            }
        }

        return new Result(new CommitHistory(newHistory, newCommits,
            toImmutable(newRelation),
            toImmutable(newInverseRelation)),
            diff, addedCommits)
    }

    /**
     * Toggle the commit
     * @param id The commit to be toggled
     * @returns The result of this operation
     */
    public toggle(id: string): Result | DeleteNonExistingText | FailToResolveDependency {
        /* Collect commits to be toggled */
        const commitToBeToggled = new Map<string, Operation>()
        const commitOps: string[] = []

        const collectCommitToBeToggled = (id: string, commit: Commit): FailToResolveDependency | null => {
            if (commit.status === Status.Enabled) {
                if (commitToBeToggled.has(id)) {
                    if (commitToBeToggled.get(id) === Operation.Enable) {
                        return new FailToResolveDependency(id)
                    }
                    return null
                }

                commitToBeToggled.set(id, Operation.Disable)
                for (const [id2, r] of this.relation.successors(id)) {
                    if (r !== Relation.Depend) continue
                    const c2 = this.commits.get(id2)
                    if (c2.status === Status.Disabled) continue

                    collectCommitToBeToggled(id2, c2)
                }
                commitOps.push(id)
            } else {
                if (commitToBeToggled.has(id)) {
                    if (commitToBeToggled.get(id) === Operation.Disable) {
                        return new FailToResolveDependency(id)
                    }
                    return null
                }

                for (const [id2, r] of this.inverseRelation.successors(id)) {
                    if (r !== Relation.Depend) continue
                    const c2 = this.commits.get(id2)
                    if (c2.status === Status.Enabled) continue

                    collectCommitToBeToggled(id2, c2)
                }

                commitToBeToggled.set(id, Operation.Enable)
                for (const [id2, r] of this.relation.successors(id)) {
                    if (r !== Relation.Exclusive) continue
                    const c2 = this.commits.get(id2)
                    if (c2.status === Status.Disabled) continue

                    collectCommitToBeToggled(id2, c2)
                }
                commitOps.push(id)
            }
            return null
        }
        const ret = collectCommitToBeToggled(id, this.commits.get(id)) // TODO error handling
        if (ret instanceof FailToResolveDependency) {
            return ret
        }

        const segmentOps: [Operation, string][] = []
        for (const commitId of commitOps) {
            segmentOps.push(...this.commits.get(commitId).toggle())
        }

        /* Apply operations */
        const result = this.history.applyOperations(segmentOps)
        if (result instanceof DeleteNonExistingText) {
            return result
        }

        /* Toggle commits */
        const newCommits = new Map(this.commits)
        for (const id of commitOps) {
            const commit = this.commits.get(id)
            newCommits.set(id,
                new Commit(commit.remove, commit.insert, commit.timestamps,
                    (commit.status === Status.Enabled) ? Status.Disabled : Status.Enabled))
        }
        return new Result(new CommitHistory(result.newHistory, newCommits,
            this.relation, this.inverseRelation),
            result.diff, new Set())
    }

    /**
     * Add date to the commit
     * @param date The date to be added
     * @param commits The set of commit to be updated
     * @returns the new history
     */
    public addDate(date: Date, commits: Set<string>): CommitHistory {
        const newCommits = new Map(this.commits)

        for (const commit of commits) {
            if (newCommits.has(commit)) {
                const c = newCommits.get(commit)
                const t = new Set(c.timestamps)
                t.add(date)
                newCommits.set(commit, new Commit(c.remove, c.insert, t, c.status))
            }
        }
        return new CommitHistory(this.history, newCommits, this.relation, this.inverseRelation)
    }

    /**
     * Add dependency from `from` to `to`
     * @returns the new history
     */
    public addDependency(from: string, to: string): CommitHistory {
        const newRelation = toMutable(this.relation)
        const newInverseRelation = toMutable(this.inverseRelation)
        newRelation.addVertex(from)
        newRelation.addVertex(to)
        newInverseRelation.addVertex(from)
        newInverseRelation.addVertex(to)
        if (newRelation.successors(from).get(to) !== Relation.Exclusive) {
            newRelation.addEdge(from, to, Relation.Depend)
            newInverseRelation.addEdge(to, from, Relation.Depend)
        }
        return new CommitHistory(this.history, this.commits,
            toImmutable(newRelation), toImmutable(newInverseRelation))
    }
    /**
     * Remove dependency from `from` to `to`
     * @returns the new history
     */
    public removeDependency(from: string, to: string): CommitHistory {
        const newRelation = toMutable(this.relation)
        const newInverseRelation = toMutable(this.inverseRelation)
        if (newRelation.successors(from).get(to) === Relation.Depend) {
            newRelation.removeEdge(from, to)
            newInverseRelation.removeEdge(to, from)
        }
        return new CommitHistory(this.history, this.commits,
            toImmutable(newRelation), toImmutable(newInverseRelation))
    }
}

export { Commit, Relation, FailToResolveDependency, Result, CommitHistory }
