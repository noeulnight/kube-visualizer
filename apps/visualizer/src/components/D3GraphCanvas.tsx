import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import * as d3 from "d3";
import type { D3ZoomEvent, ZoomBehavior } from "d3";
import {
  graphNodeHeight,
  graphNodeWidth,
  type GraphEdge,
  type GraphNode,
} from "../types/graph";

interface D3GraphCanvasProps {
  nodes: GraphNode[];
  edges: GraphEdge[];
  selectedNodeId: string | null;
  focusedNodeId: string | null;
  onNodeClick: (nodeId: string) => void;
  onInitialRenderComplete?: () => void;
}

interface HoveredNode {
  id: string;
  x: number;
  y: number;
}

interface DragState {
  nodeId: string;
  offsetX: number;
  offsetY: number;
  pointerId: number;
  didMove: boolean;
}

interface SimNode extends d3.SimulationNodeDatum {
  id: string;
}

interface SimLink extends d3.SimulationLinkDatum<SimNode> {
  source: string | SimNode;
  target: string | SimNode;
  type: string;
}

const compactNodeRadius = 7;
const detailNodeRadius = 10;
const selectedNodeRadius = 13;
const compactIconSize = 12;
const detailIconSize = 18;

const typeColors: Record<string, string> = {
  namespace: "#9467bd",
  node: "#ff7f0e",
  pod: "#1f77b4",
  service: "#2ca02c",
  ingress: "#17becf",
  deployment: "#e377c2",
  replicaSet: "#d62728",
  daemonSet: "#4f46e5",
  statefulSet: "#14b8a6",
  configMap: "#f59e0b",
  secret: "#eab308",
  serviceAccount: "#8b5cf6",
  endpointSlice: "#22c55e",
  persistentVolume: "#64748b",
  persistentVolumeClaim: "#0ea5e9",
};

const getNodeCenter = (node: GraphNode) => ({
  x: node.position.x + graphNodeWidth / 2,
  y: node.position.y + graphNodeHeight / 2,
});

export default function D3GraphCanvas({
  nodes,
  edges,
  selectedNodeId,
  focusedNodeId,
  onNodeClick,
  onInitialRenderComplete,
}: D3GraphCanvasProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const viewportRef = useRef<SVGGElement | null>(null);
  const zoomRef = useRef<ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const simulationRef = useRef<d3.Simulation<SimNode, SimLink> | null>(null);
  const simNodeByIdRef = useRef<Map<string, SimNode>>(new Map());
  const nodesRef = useRef<GraphNode[]>(nodes);
  const zoomBucketRef = useRef<"detail" | "simple">("detail");
  const dragStateRef = useRef<DragState | null>(null);
  const didInitialFitRef = useRef(false);
  const [zoomBucket, setZoomBucket] = useState<"detail" | "simple">("detail");
  const [dragPositions, setDragPositions] = useState<
    Record<string, GraphNode["position"]>
  >({});
  const [hoveredNode, setHoveredNode] = useState<HoveredNode | null>(null);

  const displayNodes = useMemo(
    () =>
      nodes.map((node) => ({
        ...node,
        position: dragPositions[node.id] ?? node.position,
      })),
    [dragPositions, nodes],
  );

  useEffect(() => {
    nodesRef.current = displayNodes;
  }, [displayNodes]);

  const nodeById = useMemo(
    () => new Map(displayNodes.map((node) => [node.id, node])),
    [displayNodes],
  );
  const hoveredGraphNode = hoveredNode
    ? nodeById.get(hoveredNode.id) || null
    : null;
  const hoveredEdgeCount = hoveredGraphNode
    ? edges.filter(
        (edge) =>
          edge.source === hoveredGraphNode.id || edge.target === hoveredGraphNode.id,
      ).length
    : 0;
  const hoveredNamespace = hoveredGraphNode?.id.split(":")[1]?.split("/")[0];

  const nodeIdsKey = useMemo(
    () => nodes.map((node) => node.id).sort().join("|"),
    [nodes],
  );
  const edgeIdsKey = useMemo(
    () => edges.map((edge) => edge.id).sort().join("|"),
    [edges],
  );
  const nodesById = useMemo(
    () => new Map(nodes.map((node) => [node.id, node])),
    [nodes],
  );
  const edgesById = useMemo(
    () => new Map(edges.map((edge) => [edge.id, edge])),
    [edges],
  );
  const getGraphPoint = useCallback((event: ReactPointerEvent) => {
    const svg = svgRef.current;
    if (!svg) return null;

    const bounds = svg.getBoundingClientRect();
    const transform = d3.zoomTransform(svg);
    const [x, y] = transform.invert([
      event.clientX - bounds.left,
      event.clientY - bounds.top,
    ]);

    return { x, y };
  }, []);

  const handleNodePointerDown = useCallback(
    (node: GraphNode, event: ReactPointerEvent<SVGElement | HTMLElement>) => {
      if (event.button !== 0) return;

      const point = getGraphPoint(event);
      if (!point) return;

      event.stopPropagation();
      event.currentTarget.setPointerCapture(event.pointerId);
      dragStateRef.current = {
        nodeId: node.id,
        offsetX: point.x - node.position.x,
        offsetY: point.y - node.position.y,
        pointerId: event.pointerId,
        didMove: false,
      };

      const simNode = simNodeByIdRef.current.get(node.id);
      if (simNode && simulationRef.current) {
        simNode.fx = getNodeCenter(node).x;
        simNode.fy = getNodeCenter(node).y;
        simulationRef.current.alphaTarget(0.3).restart();
      }
    },
    [getGraphPoint],
  );

  const handleNodePointerMove = useCallback(
    (event: ReactPointerEvent<SVGElement | HTMLElement>) => {
      const dragState = dragStateRef.current;
      if (!dragState || dragState.pointerId !== event.pointerId) return;

      const point = getGraphPoint(event);
      if (!point) return;

      event.stopPropagation();
      const nextPosition = {
        x: point.x - dragState.offsetX,
        y: point.y - dragState.offsetY,
      };
      dragState.didMove = true;
      const simNode = simNodeByIdRef.current.get(dragState.nodeId);
      if (simNode) {
        simNode.fx = nextPosition.x + graphNodeWidth / 2;
        simNode.fy = nextPosition.y + graphNodeHeight / 2;
      }
      setHoveredNode((current) =>
        current?.id === dragState.nodeId
          ? {
              id: dragState.nodeId,
              x: event.clientX,
              y: event.clientY,
            }
          : current,
      );
      setDragPositions((currentPositions) => ({
        ...currentPositions,
        [dragState.nodeId]: nextPosition,
      }));
    },
    [getGraphPoint],
  );

  const handleNodePointerUp = useCallback(
    (event: ReactPointerEvent<SVGElement | HTMLElement>) => {
      const dragState = dragStateRef.current;
      if (!dragState || dragState.pointerId !== event.pointerId) return;

      event.stopPropagation();
      event.currentTarget.releasePointerCapture(event.pointerId);
      dragStateRef.current = null;

      const simNode = simNodeByIdRef.current.get(dragState.nodeId);
      if (simNode && simulationRef.current) {
        simNode.fx = null;
        simNode.fy = null;
        simulationRef.current.alphaTarget(0);
      }

      if (!dragState.didMove) {
        onNodeClick(dragState.nodeId);
      }
    },
    [onNodeClick],
  );

  const fitView = useCallback(
    (duration = 450) => {
      const svg = svgRef.current;
      const currentNodes = nodesRef.current;
      if (!svg || !zoomRef.current || currentNodes.length === 0) return;

      const width = svg.clientWidth;
      const height = svg.clientHeight;
      if (width === 0 || height === 0) return;

      const minX = d3.min(currentNodes, (node) => node.position.x) ?? 0;
      const minY = d3.min(currentNodes, (node) => node.position.y) ?? 0;
      const maxX =
        (d3.max(currentNodes, (node) => node.position.x) ?? 0) + graphNodeWidth;
      const maxY =
        (d3.max(currentNodes, (node) => node.position.y) ?? 0) +
        graphNodeHeight;
      const graphWidth = Math.max(maxX - minX, graphNodeWidth);
      const graphHeight = Math.max(maxY - minY, graphNodeHeight);
      const scale = Math.min(
        1.2,
        Math.max(
          0.15,
          Math.min(width / graphWidth, height / graphHeight) * 0.85,
        ),
      );
      const x = (width - graphWidth * scale) / 2 - minX * scale;
      const y = (height - graphHeight * scale) / 2 - minY * scale;
      const transform = d3.zoomIdentity.translate(x, y).scale(scale);

      d3.select(svg)
        .transition()
        .duration(duration)
        .call(zoomRef.current.transform, transform);
    },
    [],
  );

  useEffect(() => {
    const svg = svgRef.current;
    const viewport = viewportRef.current;
    if (!svg || !viewport) return;

    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.12, 3])
      .filter((event) => {
        const target = event.target as Element | null;
        if (!target?.closest("[data-node-drag-handle]")) return true;
        return event.type === "wheel";
      })
      .on("zoom", (event: D3ZoomEvent<SVGSVGElement, unknown>) => {
        d3.select(viewport).attr("transform", event.transform.toString());
        const nextBucket = event.transform.k < 0.55 ? "simple" : "detail";
        if (zoomBucketRef.current !== nextBucket) {
          zoomBucketRef.current = nextBucket;
          setZoomBucket(nextBucket);
        }
      });

    zoomRef.current = zoom;
    d3.select(svg).call(zoom);

    return () => {
      d3.select(svg).on(".zoom", null);
      zoomRef.current = null;
    };
  }, []);

  useEffect(() => {
    simulationRef.current?.stop();

    const currentNodeById = new Map(
      nodesRef.current.map((node) => [node.id, node]),
    );
    const currentNodes = nodeIdsKey
      ? nodeIdsKey
          .split("|")
          .map((nodeId) => nodesById.get(nodeId))
          .filter((node): node is GraphNode => Boolean(node))
      : [];
    const currentEdges = edgeIdsKey
      ? edgeIdsKey
          .split("|")
          .map((edgeId) => edgesById.get(edgeId))
          .filter((edge): edge is GraphEdge => Boolean(edge))
      : [];
    const columns = Math.max(1, Math.ceil(Math.sqrt(currentNodes.length)));
    const spacing = 42;
    const simNodes: SimNode[] = currentNodes.map((node, index) => {
      const currentNode = currentNodeById.get(node.id);
      if (currentNode) {
        const center = getNodeCenter(currentNode);
        return { id: node.id, x: center.x, y: center.y };
      }

      const column = index % columns;
      const row = Math.floor(index / columns);
      return {
        id: node.id,
        x: (column - columns / 2) * spacing,
        y: row * spacing,
      };
    });
    const simLinks: SimLink[] = currentEdges.map((edge) => ({
      source: edge.source,
      target: edge.target,
      type: edge.label,
    }));

    simNodeByIdRef.current = new Map(simNodes.map((node) => [node.id, node]));

    const simulation = d3
      .forceSimulation<SimNode>(simNodes)
      .force(
        "link",
        d3
          .forceLink<SimNode, SimLink>(simLinks)
          .id((node) => node.id)
          .distance((link) => {
            if (link.type === "owner") return 52;
            if (link.type === "contains") return 46;
            return 66;
          })
          .strength(0.85),
      )
      .force("charge", d3.forceManyBody<SimNode>().strength(-95))
      .force("collide", d3.forceCollide<SimNode>(14).strength(0.95))
      .force("x", d3.forceX<SimNode>(0).strength(0.12))
      .force("y", d3.forceY<SimNode>(0).strength(0.12));

    let animationFrame: number | null = null;
    simulation.on("tick", () => {
      if (animationFrame !== null) return;

      animationFrame = requestAnimationFrame(() => {
        animationFrame = null;
        setDragPositions(
          Object.fromEntries(
            simNodes.map((node) => [
              node.id,
              {
                x: (node.x ?? 0) - graphNodeWidth / 2,
                y: (node.y ?? 0) - graphNodeHeight / 2,
              },
            ]),
          ),
        );
      });
    });

    simulationRef.current = simulation;

    return () => {
      if (animationFrame !== null) {
        cancelAnimationFrame(animationFrame);
      }
      simulation.stop();
    };
  }, [edgeIdsKey, edgesById, nodeIdsKey, nodesById]);

  useEffect(() => {
    if (didInitialFitRef.current || displayNodes.length === 0) return;
    didInitialFitRef.current = true;
    fitView();
  }, [displayNodes.length, fitView]);

  useEffect(() => {
    if (!onInitialRenderComplete || displayNodes.length === 0) return;

    let firstFrame: number | null = null;
    let secondFrame: number | null = null;
    const timeout = window.setTimeout(() => {
      firstFrame = requestAnimationFrame(() => {
        secondFrame = requestAnimationFrame(onInitialRenderComplete);
      });
    }, 550);

    return () => {
      window.clearTimeout(timeout);
      if (firstFrame !== null) {
        cancelAnimationFrame(firstFrame);
      }
      if (secondFrame !== null) {
        cancelAnimationFrame(secondFrame);
      }
    };
  }, [displayNodes.length, onInitialRenderComplete]);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg || !zoomRef.current || !focusedNodeId) return;

    const node = nodesRef.current.find(
      (candidate) => candidate.id === focusedNodeId,
    );
    if (!node) return;

    const width = svg.clientWidth;
    const height = svg.clientHeight;
    const center = getNodeCenter(node);
    const scale = 1.3;
    const transform = d3.zoomIdentity
      .translate(width / 2 - center.x * scale, height / 2 - center.y * scale)
      .scale(scale);

    d3.select(svg)
      .transition()
      .duration(800)
      .call(zoomRef.current.transform, transform);
  }, [focusedNodeId]);

  const currentNodeRadius = zoomBucket === "detail"
    ? detailNodeRadius
    : compactNodeRadius;
  const currentIconSize = zoomBucket === "detail"
    ? detailIconSize
    : compactIconSize;

  return (
    <div className="relative h-full w-full bg-black">
      <svg ref={svgRef} className="h-full w-full cursor-grab active:cursor-grabbing">
        <defs>
          <pattern
            id="grid"
            width="24"
            height="24"
            patternUnits="userSpaceOnUse"
          >
            <path
              d="M 24 0 L 0 0 0 24"
              fill="none"
              stroke="rgba(148, 163, 184, 0.12)"
              strokeWidth="1"
            />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid)" />
        <g ref={viewportRef}>
          <g>
            {edges.map((edge) => {
              const source = nodeById.get(edge.source);
              const target = nodeById.get(edge.target);
              if (!source || !target) return null;

              const start = getNodeCenter(source);
              const end = getNodeCenter(target);

              return (
                <g
                  key={edge.id}
                  className={edge.animated && zoomBucket === "detail" ? "d3-edge-flow" : ""}
                >
                  <line
                    x1={start.x}
                    y1={start.y}
                    x2={end.x}
                    y2={end.y}
                    stroke={edge.style.stroke}
                    strokeOpacity="0.6"
                    strokeWidth={edge.style.strokeWidth}
                    strokeLinecap="round"
                  />
                </g>
              );
            })}
          </g>
          <g stroke="#fff" strokeWidth="1.5">
            {displayNodes.map((node) => {
              const selected = selectedNodeId === node.id;
              const center = getNodeCenter(node);
              const color = typeColors[node.type] || "#7f7f7f";

              return (
                <g
                  key={node.id}
                  transform={`translate(${center.x}, ${center.y})`}
                  role="button"
                  tabIndex={0}
                  onPointerDown={(event) => handleNodePointerDown(node, event)}
                  onPointerMove={handleNodePointerMove}
                  onPointerUp={handleNodePointerUp}
                  onPointerEnter={(event) =>
                    setHoveredNode({
                      id: node.id,
                      x: event.clientX,
                      y: event.clientY,
                    })
                  }
                  onPointerLeave={() => setHoveredNode(null)}
                  className="cursor-move"
                  data-node-drag-handle="true"
                >
                  <circle
                    r={selected ? selectedNodeRadius : currentNodeRadius}
                    fill={color}
                    fillOpacity={zoomBucket === "detail" ? 0.22 : 0.9}
                    stroke={selected ? "#bfdbfe" : "none"}
                    strokeWidth={selected ? 0.7 : 0}
                  />
                  <image
                    href={`/k8s/${node.data.icon}`}
                    x={-currentIconSize / 2}
                    y={-currentIconSize / 2}
                    width={currentIconSize}
                    height={currentIconSize}
                    preserveAspectRatio="xMidYMid meet"
                    className="pointer-events-none"
                  />
                </g>
              );
            })}
          </g>
        </g>
      </svg>
      {hoveredGraphNode && hoveredNode && (
        <div
          className="pointer-events-none fixed z-50 min-w-48 max-w-80 rounded border border-white/10 bg-black/90 px-3 py-2 text-xs text-white shadow-2xl backdrop-blur-md"
          style={{
            left: Math.max(
              12,
              Math.min(hoveredNode.x + 14, window.innerWidth - 280),
            ),
            top: Math.max(
              12,
              Math.min(hoveredNode.y + 14, window.innerHeight - 160),
            ),
          }}
        >
          <div className="mb-1 flex items-center gap-2">
            <img
              src={`/k8s/${hoveredGraphNode.data.icon}`}
              alt=""
              className="h-4 w-4"
            />
            <span className="font-semibold">{hoveredGraphNode.data.label}</span>
          </div>
          <div className="space-y-0.5 text-[11px] text-white/60">
            <div>
              <span className="text-white/40">Type</span>{" "}
              <span className="font-mono text-white/80">
                {hoveredGraphNode.type}
              </span>
            </div>
            {hoveredNamespace !== undefined && hoveredNamespace !== "" && (
              <div>
                <span className="text-white/40">Namespace</span>{" "}
                <span className="font-mono text-white/80">
                  {hoveredNamespace}
                </span>
              </div>
            )}
            <div>
              <span className="text-white/40">Edges</span>{" "}
              <span className="font-mono text-white/80">{hoveredEdgeCount}</span>
            </div>
            <div className="truncate font-mono text-white/45">
              {hoveredGraphNode.id}
            </div>
          </div>
        </div>
      )}
      <div className="absolute bottom-16 left-3 flex overflow-hidden rounded border border-white/10 bg-white/5 shadow-xl backdrop-blur-md sm:bottom-4 sm:left-4">
        <button
          type="button"
          onClick={() => {
            const svg = svgRef.current;
            if (!svg || !zoomRef.current) return;
            d3.select(svg)
              .transition()
              .duration(180)
              .call(zoomRef.current.scaleBy, 1.2);
          }}
          className="h-8 w-8 border-r border-white/10 text-white/80 hover:bg-white/10"
          aria-label="Zoom in"
        >
          +
        </button>
        <button
          type="button"
          onClick={() => {
            const svg = svgRef.current;
            if (!svg || !zoomRef.current) return;
            d3.select(svg)
              .transition()
              .duration(180)
              .call(zoomRef.current.scaleBy, 0.8);
          }}
          className="h-8 w-8 border-r border-white/10 text-white/80 hover:bg-white/10"
          aria-label="Zoom out"
        >
          -
        </button>
        <button
          type="button"
          onClick={() => fitView(250)}
          className="h-8 px-3 text-xs font-semibold text-white/80 hover:bg-white/10"
        >
          Fit
        </button>
      </div>
    </div>
  );
}
