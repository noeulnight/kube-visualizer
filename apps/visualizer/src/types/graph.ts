export interface GraphNodeData {
  label: string;
  icon: string;
}

export interface GraphNode {
  id: string;
  type: string;
  data: GraphNodeData;
  position: {
    x: number;
    y: number;
  };
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  label: string;
  animated: boolean;
  style: {
    stroke: string;
    strokeWidth: number;
  };
}

export const graphNodeWidth = 24;
export const graphNodeHeight = 24;
