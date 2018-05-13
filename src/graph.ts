import { ConstrainedData } from "./common"

/** Constraints of the directed graph */
type Predicate<V, L> = (self: DirectedGraph<V, L>) => string | null

/** A labeled directed graph */
class DirectedGraph<V, L> extends ConstrainedData {
    /**
     * @param vertices The vertex set
     * @param edges The edge set (there is a v1 -> v2 edge with label `l` if this.edges.get(v1) contains (v2, l))
     * @param pred The user defined constraint
     */
    constructor(public readonly vertices: Set<V>, public readonly edges: Map<V, Map<V, L>>,
                private readonly pred?: Predicate<V, L>) {
        super()
    }
    /**
     * @param v
     * @returns The successors of `v` with labels of the edges
     */
    public successors(v: V): Map<V, L> {
        return this.edges.has(v) ? this.edges.get(v) : new Map()
    }
    public validate(): string | null {
        /* Invalid if an edge connects vertices that are not in this.vertices */
        for (const edge of this.edges) {
            const [v1, vs] = edge
            if (!this.vertices.has(v1)) {
                return `the vertex (${v1}) is not in the vertices set`
            }
            for (const v of vs) {
                const v2 = v[0]
                if (!this.vertices.has(v2)) {
                    return `the vertex (${v2}) is not in the vertices set`
                }
            }
        }
        if (this.pred) {
            return this.pred(this)
        }
        return null
    }
}

export { Predicate, DirectedGraph }
