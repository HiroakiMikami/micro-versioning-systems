import { Commit } from './commit'

/**
 * 
 * @param commits The set of commit to be calculated scores
 * @returns the score for each commit
 */
function evaluate(commits: Map<string, Commit>): Map<string, number> {
    let minTime = null
    let maxTime = null
    for (const elem of commits) {
        const commit = elem[1]
        for (const time of commit.timestamps) {
            if (minTime === null) {
                minTime = time.getTime()
            }
            if (maxTime === null) {
                maxTime = time.getTime()
            }

            minTime = Math.min(minTime, time.getTime())
            maxTime = Math.max(maxTime, time.getTime())
        }
    }

    
    let retval = new Map()
    for (const [id, commit] of commits) {
        let score = 0
        for (const time of commit.timestamps) {
            const t = (minTime === maxTime) ? 0 : (time.getTime() - minTime) / (maxTime - minTime)
            score += 1 / (1 + Math.exp(-12 * t + 12))
        }
        retval.set(id, score)
    }

    return retval
}

export { evaluate }
