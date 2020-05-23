import * as d3 from "d3"
import { SerializableHistory, SerializableCommit, SerializableRelation } from '../graph_viewer';
import { Status } from '../../common';
import { Relation } from '../../commit';

declare const acquireVsCodeApi: () => { postMessage: (msg: any) => void };
let vscode: { postMessage: (msg: any) => void };

function onReady(callback: () => void): void {
	vscode = acquireVsCodeApi()
    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", callback)
    } else {
        callback()
    }
}

function update(history: SerializableHistory) {
	const svg = d3.select("svg")
	// TODO Remove old content
	// TODO Resize SVG after resizing
	const width = (<Element>svg.node()).getBoundingClientRect().width;
	const height = (<Element>svg.node()).getBoundingClientRect().height;
	const color = d3.schemeCategory10;

	type Node = SerializableCommit & d3.SimulationNodeDatum;
	type Link = SerializableRelation & d3.SimulationLinkDatum<Node>;
	const nodes: Node[] = Array.from(history.commits)
	const idToNodes = new Map()
	for (const node of nodes) {
		idToNodes.set(node.id, node)
	}
	const links: Link[] = Array.from(history.edges)

	const node = svg.selectAll(".node")
		.data(nodes)
		.enter()
		.append("g")
		.attr("class", "node")
	node.append("circle")
		.attr("r", 10)
		.style("fill", (commit: SerializableCommit) => {
			if (commit.status === Status.Enabled) {
				return color[0];
			} else {
				return color[7];
			}
		})
	node.append("title")
		.text((commit: SerializableCommit) => commit.id)
	node.append("text")
		.text((commit: SerializableCommit) => commit.remove)
		.attr("class", "delete")
	node.append("text")
		.text((commit: SerializableCommit) => commit.insert)
		.attr("class", "insert")
	node.on("click", (d: Node) => {
		vscode.postMessage(d)
	})

	svg.append('defs')
		.append('marker')
		.attr('id', 'arrowhead')
        .attr('viewBox', '-0 -5 10 10')
        .attr('refX', 13)
        .attr('refY', 0)
        .attr('orient', 'auto')
        .attr('markerWidth', 13)
        .attr('markerHeight', 13)
        .attr('xoverflow','visible')
        .append('svg:path')
        .attr('d', 'M 0,-5 L 10 ,0 L 0,5')
        .attr('fill', '#999')
		.style('stroke','none')

	const link = svg
		.selectAll("line")
		.data(links)
		.enter()
		.append("line")
		.attr("stroke", "white")
		.attr("marker-end", "url(#arrowhead)")
		.attr("stroke-dasharray", (d: Link) => {
			if (d.relation === Relation.Depend) {
				return null;
			} else {
				return "4 4";
			}
		})

	const simulation = d3.forceSimulation()
		.force("link", d3.forceLink()
			.id((d: Node) => d.id)
			.distance(100)
			.strength(1)
		)
		.force("charge", d3.forceManyBody())
		.force("center", d3.forceCenter(width / 2, height / 2))
	simulation
		.nodes(nodes)
	simulation
		.on("tick", () => {
			node.attr("transform", d => `translate(${d.x}, ${d.y})`)
			link
				.attr("x1", (d: any) => {return idToNodes.get(d.source).x;})
				.attr("y1", (d: any) => {return idToNodes.get(d.source).y;})
				.attr("x2", (d: any) => {return idToNodes.get(d.target).x;})
				.attr("y2", (d: any) => {return idToNodes.get(d.target).y;});
		})
}

onReady(() => {
    // Handle messages sent from the extension to the webview
    window.addEventListener('message', event => {
		const method = event.data.method;
		if (method === "update") {
			const body: SerializableHistory = event.data.body;
			update(body)
		} else {
			// TODO error
		}
    });
})
