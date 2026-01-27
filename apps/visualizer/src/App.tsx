import { useCallback, useEffect, useRef, useState } from "react";
import {
  ReactFlow,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  getIncomers,
  getOutgoers,
  getConnectedEdges,
  type Connection,
  type Node,
  type Edge as FlowEdge,
  MiniMap,
  Controls,
  Panel,
  type NodeMouseHandler,
} from "@xyflow/react";
import dagre from "dagre";

import "@xyflow/react/dist/style.css";
import ResourceDetailPanel from "./components/ResourceDetailPanel";
import { typeMapping } from "./types/resources";
import ResourceTypeFilter from "./components/ResourceTypeFilter";
import ConnectionStatus from "./components/ConnectionStatus";

export interface EdgeData {
  source: string;
  target: string;
  type: string;
}
export const ResourceType = {
  Pod: "Pod",
  Namespace: "Namespace",
  Node: "Node",
  Ingress: "Ingress",
  PersistentVolumeClaim: "PersistentVolumeClaim",
  PersistentVolume: "PersistentVolume",
  Deployment: "Deployment",
  ReplicaSet: "ReplicaSet",
  Service: "Service",
  ConfigMap: "ConfigMap",
  Secret: "Secret",
  ServiceAccount: "ServiceAccount",
  EndpointSlice: "EndpointSlice",
  DaemonSet: "DaemonSet",
  StatefulSet: "StatefulSet",
} as const;

export type ResourceType = (typeof ResourceType)[keyof typeof ResourceType];

export interface NodeMetadata {
  id: string;
  name: string;
  namespace: string | undefined;
  resourceType: ResourceType;
}

export interface Delta {
  addedNodes: NodeMetadata[];
  modifiedNodes: NodeMetadata[];

  removedNodes: string[];

  addedEdges: EdgeData[];
  removedEdges: EdgeData[];
}

import { nodeTypes } from "./components/nodes/nodeTypes";
import ResourceSearch from "./components/ResourceSearch";

const nodeWidth = 200;
const nodeHeight = 80;

const getLayoutedElements = (nodes: Node[], edges: FlowEdge[]) => {
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));
  dagreGraph.setGraph({ rankdir: "LR", nodesep: 8, ranksep: 200 });

  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, { width: nodeWidth, height: nodeHeight });
  });

  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  dagre.layout(dagreGraph);

  const newNodes = nodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    return {
      ...node,
      targetPosition: "left",
      sourcePosition: "right",
      position: {
        x: nodeWithPosition.x - nodeWidth / 2,
        y: nodeWithPosition.y - nodeHeight / 2,
      },
    } as Node;
  });

  return { nodes: newNodes, edges };
};

const createEdge = (e: any): FlowEdge => {
  let style = { stroke: "#999", strokeWidth: 1 };
  let animated = false;

  if (e.type === "owner") {
    style = { stroke: "#f43f5e", strokeWidth: 2 }; // rose-500
  } else if (e.type === "contains") {
    style = { stroke: "#a855f7", strokeWidth: 1 }; // purple-500
  } else if (e.type === "selects") {
    style = { stroke: "#22c55e", strokeWidth: 1.5 }; // green-500
    animated = true;
  } else if (e.type === "routes-to") {
    style = { stroke: "#06b6d4", strokeWidth: 2 }; // cyan-500
    animated = true;
  }

  return {
    id: `e-${e.type}-${e.source}-${e.target}`,
    source: e.source,
    target: e.target,
    label: e.type,
    type: "smoothstep",
    animated,
    style,
    labelStyle: { fill: "#999", fontSize: 8, fontWeight: 700 },
  };
};

export default function Flow() {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<FlowEdge>([]);
  const [connected, setConnected] = useState<boolean>(false);
  const [reconnecting, setReconnecting] = useState<boolean>(false);
  const [reconnectAttempt, setReconnectAttempt] = useState<number>(0);
  const [allNodes, setAllNodes] = useState<Node[]>([]);
  const [allEdges, setAllEdges] = useState<FlowEdge[]>([]);
  const [visibleResourceTypes, setVisibleResourceTypes] = useState<Set<string>>(
    new Set(Object.values(typeMapping)),
  );
  const [selectedResourceId, setSelectedResourceId] = useState<string | null>(
    null,
  );

  // Keep refs to have access to the latest state in the EventSource closure
  const nodesRef = useRef(nodes);
  const edgesRef = useRef(edges);

  useEffect(() => {
    nodesRef.current = nodes;
  }, [nodes]);

  useEffect(() => {
    edgesRef.current = edges;
  }, [edges]);

  useEffect(() => {
    const filteredNodes = allNodes.filter((node) =>
      visibleResourceTypes.has(node.type || ""),
    );
    const filteredNodeIds = new Set(filteredNodes.map((n) => n.id));
    const filteredEdges = allEdges.filter(
      (edge) =>
        filteredNodeIds.has(edge.source) && filteredNodeIds.has(edge.target),
    );

    const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(
      filteredNodes,
      filteredEdges,
    );
    setNodes(layoutedNodes);
    setEdges(layoutedEdges);
  }, [visibleResourceTypes, allNodes, allEdges, setNodes, setEdges]);

  useEffect(() => {
    let eventSource: EventSource | null = null;
    let reconnectTimeout: number | null = null;
    let isMounted = true;

    const connect = (attempt: number = 0) => {
      if (!isMounted) return;

      const apiUrl = import.meta.env.VITE_API_URL || "";
      eventSource = new EventSource(`${apiUrl}/events`);

      eventSource.onopen = () => {
        if (!isMounted) return;
        setConnected(true);
        setReconnecting(false);
        setReconnectAttempt(0);
        console.log("Connected to cluster");
      };

      eventSource.onerror = (err) => {
        console.error("EventSource failed:", err);
        if (!isMounted) return;

        setConnected(false);
        eventSource?.close();

        // Exponential backoff: 1s, 2s, 4s, 8s, max 30s
        const backoffDelay = Math.min(1000 * Math.pow(2, attempt), 30000);
        const nextAttempt = attempt + 1;

        setReconnecting(true);
        setReconnectAttempt(nextAttempt);

        console.log(
          `Reconnecting in ${backoffDelay / 1000}s (attempt ${nextAttempt})...`,
        );

        reconnectTimeout = setTimeout(() => {
          if (isMounted) {
            connect(nextAttempt);
          }
        }, backoffDelay);
      };

      eventSource.onmessage = (event) => {
        if (!isMounted) return;
        setConnected(true);
        const delta = JSON.parse(event.data) as Delta;

        if (delta.addedNodes.length > 0) {
          const newNodes: Node[] = delta.addedNodes.map((n) => ({
            id: n.id,
            type: typeMapping[n.resourceType] || "pod",
            data: { label: n.name },
            position: { x: 0, y: 0 },
          }));
          setAllNodes((nds) => {
            const nodeMap = new Map(nds.map((n) => [n.id, n]));
            newNodes.forEach((n) => nodeMap.set(n.id, n));
            return Array.from(nodeMap.values());
          });
        }

        // Handle modified nodes
        if (delta.modifiedNodes.length > 0) {
          setAllNodes((nds) =>
            nds.map((node) => {
              const modified = delta.modifiedNodes.find(
                (m) => m.id === node.id,
              );
              if (modified) {
                return {
                  ...node,
                  type: typeMapping[modified.resourceType] || "pod",
                  data: { ...node.data, label: modified.name },
                };
              }
              return node;
            }),
          );
        }

        // Handle removed nodes
        if (delta.removedNodes.length > 0) {
          setAllNodes((nds) =>
            nds.filter((node) => !delta.removedNodes.includes(node.id)),
          );
          setAllEdges((eds) =>
            eds.filter(
              (edge) =>
                !delta.removedNodes.includes(edge.source) &&
                !delta.removedNodes.includes(edge.target),
            ),
          );
        }

        // Handle added edges
        if (delta.addedEdges.length > 0) {
          const newEdges = delta.addedEdges.map((e) => createEdge(e));
          setAllEdges((eds) => {
            const edgeMap = new Map(eds.map((e) => [e.id, e]));
            newEdges.forEach((e) => edgeMap.set(e.id, e));
            return Array.from(edgeMap.values());
          });
        }

        // Handle removed edges
        if (delta.removedEdges.length > 0) {
          setAllEdges((eds) =>
            eds.filter(
              (edge) =>
                !delta.removedEdges.some(
                  (re) =>
                    re.source === edge.source && re.target === edge.target,
                ),
            ),
          );
        }
      };
    };

    connect();

    return () => {
      isMounted = false;
      setConnected(false);
      setReconnecting(false);
      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
      }
      eventSource?.close();
    };
  }, [setAllNodes, setAllEdges]);

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge(params, eds)),
    [setEdges],
  );

  const onNodesDelete = useCallback(
    (deleted: Node[]) => {
      let remainingNodes = [...nodes];
      setEdges((eds) =>
        deleted.reduce((acc, node) => {
          const incomers = getIncomers(node, remainingNodes, acc);
          const outgoers = getOutgoers(node, remainingNodes, acc);
          const connectedEdges = getConnectedEdges([node], acc);

          const remainingEdges = acc.filter(
            (edge) => !connectedEdges.includes(edge),
          );

          const createdEdges = incomers.flatMap(({ id: source }) =>
            outgoers.map(({ id: target }) => ({
              id: `${source}->${target}`,
              source,
              target,
            })),
          );

          remainingNodes = remainingNodes.filter((rn) => rn.id !== node.id);

          return [...remainingEdges, ...createdEdges];
        }, eds),
      );
    },
    [nodes, setEdges],
  );

  const onNodeClick: NodeMouseHandler = useCallback((_event, node) => {
    // Create resource ID from node data
    const resourceId = node.id;
    setSelectedResourceId(resourceId);
  }, []);

  return (
    <div
      style={{
        width: "100vw",
        height: "100vh",
      }}
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onNodesDelete={onNodesDelete}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={onNodeClick}
        nodeTypes={nodeTypes}
        fitView
        colorMode={"dark"}
      >
        <Background />
        <MiniMap />
        <Controls />

        <Panel position="top-left">
          <div className="flex flex-col gap-2">
            <ResourceSearch
              nodes={nodes}
              onSelectNode={setSelectedResourceId}
            />
            {selectedResourceId && (
              <ResourceDetailPanel
                resourceId={selectedResourceId}
                onClose={() => setSelectedResourceId(null)}
              />
            )}
          </div>
        </Panel>

        <Panel position="top-right" className="space-y-2">
          <ConnectionStatus
            connected={connected}
            reconnecting={reconnecting}
            reconnectAttempt={reconnectAttempt}
          />
          <ResourceTypeFilter
            allNodes={allNodes}
            visibleResourceTypes={visibleResourceTypes}
            setVisibleResourceTypes={setVisibleResourceTypes}
          />
        </Panel>
      </ReactFlow>
    </div>
  );
}
