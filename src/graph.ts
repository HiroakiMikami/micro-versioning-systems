import { ConstrainedData } from "./common"

/** Constraints of the directed graph */
type Predicate<V, L> = (self: DirectedGraph<V, L>) => string | null

/** A labeled directed graph */
interface DirectedGraph<V, L> {
    /** The vertex set */
    readonly vertices: ReadonlySet<V>
    /** The edge set (there is a v1 -> v2 edge with label `l` if this.edges.get(v1) contains (v2, l)) */
    readonly edges: ReadonlyMap<V, ReadonlyMap<V, L>>
    /**
     * @param v
     * @returns The successors of `v` with labels of the edges
     */
    successors(v: V): ReadonlyMap<V, L>
}

/**
 * @param vertices The vertex set
 * @param edges The edge set (there is a v1 -> v2 edge with label `l` if this.edges.get(v1) contains (v2, l))
 * @param pred The user defined constraint
 * @returns The error message
 */
function validate<V, L>(vertices: ReadonlySet<V>,
                        edges: ReadonlyMap<V, ReadonlyMap<V, L>>,
                        pred?: Predicate<V, L>): string | null {
    /* Invalid if an edge connects vertices that are not in this.vertices */
    for (const edge of edges) {
        const [v1, vs] = edge
        if (!vertices.has(v1)) {
            return `the vertex (${v1}) is not in the vertices set`
        }
        for (const v of vs) {
            const v2 = v[0]
            if (!vertices.has(v2)) {
                return `the vertex (${v2}) is not in the vertices set`
            }
        }
    }
    if (pred) {
        return pred(new ImmutableDirectedGraph(vertices, edges))
    }
    return null
}

/** A immutable labeled directed graph */
class ImmutableDirectedGraph<V, L> extends ConstrainedData {
    /**
     * @param vertices The vertex set
     * @param edges The edge set (there is a v1 -> v2 edge with label `l` if this.edges.get(v1) contains (v2, l))
     * @param pred The user defined constraint
     */
    constructor(public readonly vertices: ReadonlySet<V>, public readonly edges: ReadonlyMap<V, ReadonlyMap<V, L>>,
                protected readonly pred?: Predicate<V, L>) {
        super(() => validate(vertices, edges, pred))
    }

    /**
     * @param v
     * @returns The successors of `v` with labels of the edges
     */
    public successors(v: V): ReadonlyMap<V, L> {
        return this.edges.has(v) ? this.edges.get(v) : new Map()
    }
}

/** A mutable labeled directed graph */
class MutableDirectedGraph<V, L> extends ConstrainedData {
    /**
     * @param vertices The vertex set
     * @param edges The edge set (there is a v1 -> v2 edge with label `l` if this.edges.get(v1) contains (v2, l))
     * @param pred The user defined constraint
     */
    constructor(public readonly vertices: Set<V>, public readonly edges: Map<V, Map<V, L>>,
                protected readonly pred?: Predicate<V, L>) {
        super(() => validate(vertices, edges, pred))
    }

    /**
     * @param v
     * @returns The successors of `v` with labels of the edges
     */
    public successors(v: V): ReadonlyMap<V, L> {
        return this.edges.has(v) ? this.edges.get(v) : new Map()
    }

    /**
     * @param v The vertex to be added
     */
    public addVertex(v: V) {
        this.vertices.add(v)
    }
    /**
     * @param v The vertex to be removed
     */
    public removeVertex(v: V) {
        this.vertices.delete(v)
        this.edges.delete(v)
        let tmp = []
        for (const elem of this.edges) {
            if (elem[1].has(v)) {
                tmp.push([elem[0], v])
            }
        }
        for (const [v1, v2] of tmp) {
            this.removeEdge(v1, v2)
        }
    }
    /**
     * @param v1 The endpoint vertex of the edge to be added (1)
     * @param v2 The endpoint vertex of the edge to be added (2)
     * @param label The label of the edge to be added
     */
    public addEdge(v1: V, v2: V, label: L) {
        if (!this.edges.has(v1)) {
            this.edges.set(v1, new Map([[v2, label]]))
        } else {
            this.edges.get(v1).set(v2, label)
        }
    }
    /**
     * @param v1 The endpoint vertex of the edge to be removed(1)
     * @param v2 The endpoint vertex of the edge to be removed (2)
     */
    public removeEdge(v1: V, v2: V) {
        if (!this.edges.has(v1)) return
        this.edges.get(v1).delete(v2)
        if (this.edges.get(v1).size == 0) {
            this.edges.delete(v1)
        }
    }
}
/**
 * @returns The immutable object of the graph
 */
function to_immutable<V, L>(graph: DirectedGraph<V, L>): ImmutableDirectedGraph<V, L> {
    const edges = new Map()
    for (const [v1, vs] of graph.edges) {
        edges.set(v1, new Map(Array.from(vs)))
    }
    return new ImmutableDirectedGraph<V, L>(new Set(Array.from(graph.vertices)), edges)
}

/**
 * @returns The mutable object of the graph
 */
function to_mutable<V, L>(graph: DirectedGraph<V, L>): MutableDirectedGraph<V, L> {
    const edges = new Map()
    for (const [v1, vs] of graph.edges) {
        edges.set(v1, new Map(Array.from(vs)))
    }
    return new MutableDirectedGraph<V, L>(new Set(Array.from(graph.vertices)), edges)
}

export { Predicate, DirectedGraph, ImmutableDirectedGraph, MutableDirectedGraph, to_immutable, to_mutable }
